"use client";
import { UserContext } from "@/context/user";
import {
  CapsTSVResult,
  ENERGY_TYPE,
  TariffCategory,
  TariffType,
  gsp,
} from "@/data/source";
import useYearlyTariffQuery from "@/hooks/useYearlyTariffQuery";
import { evenRound } from "@/utils/helpers";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import useCurrentLocationPriceCapQuery from "./useCurrentLocationPriceCapQuery";
import usePriceCapQuery from "./usePriceCapQuery";
import { DSVParsedArray } from "d3";

export type IConsumptionCalculator = {
  deviceNumber: string;
  serialNo: string;
  tariff: string;
  fromDate: string;
  toDate: string;
  type: Exclude<TariffType, "EG">;
  category: TariffCategory;
  results?: "monthly" | "yearly";
};

const useConsumptionCalculation = (inputs: IConsumptionCalculator) => {
  const { value } = useContext(UserContext);

  const {
    tariff,
    fromDate,
    toDate,
    type,
    category,
    deviceNumber,
    serialNo,
    results = "yearly",
  } = inputs;

  const groupBy = {
    Agile: "",
    Go: "",
    Cosy: "",
    Tracker: "&group_by=day",
    SVT: "&group_by=day",
    Fixed: "&group_by=day",
  };

  const fromISODate = new Date(fromDate).toISOString();
  const toISODate = new Date(toDate).toISOString();
  //get readings
  const queryFn = async () => {
    try {
      // page_size 25000 is a year's data
      const response = await fetch(
        `https://api.octopus.energy/v1/${ENERGY_TYPE[type]}-meter-points/${deviceNumber}/meters/${serialNo}/consumption/?period_from=${fromISODate}&period_to=${toISODate}&page_size=25000${groupBy[category]}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(value.apiKey)}`,
          },
        }
      );
      if (!response.ok) throw new Error("Sorry the request was unsuccessful");
      return response.json();
    } catch (err: unknown) {
      if (err instanceof Error)
        throw new Error(`Sorry, we have an error: ${err.message}`);
      throw new Error("Sorry, the request was unsuccessful");
    }
  };

  const queryFnStandingChargeData = async () => {
    try {
      const response = await fetch(
        `https://api.octopus.energy/v1/products/${tariff}/${ENERGY_TYPE[type]}-tariffs/${type}-1R-${tariff}-${value.gsp}/standing-charges/?page_size=1500&period_from=${fromISODate}&period_to=${toISODate}`
      );
      if (!response.ok) throw new Error("Sorry the request was unsuccessful");
      return response.json();
    } catch (err: unknown) {
      if (err instanceof Error)
        throw new Error(`Sorry, we have an error: ${err.message}`);
      throw new Error("Sorry, the request was unsuccessful");
    }
  };

  const caps = usePriceCapQuery({ gsp: `_${value.gsp}` as gsp });

  const {
    data: consumptionData,
    isSuccess,
    isLoading,
  } = useQuery({
    queryKey: [deviceNumber, serialNo, category, fromISODate, toISODate],
    queryFn,
    enabled: !!deviceNumber && !!serialNo && !!category,
  });

  const {
    data: rateData,
    isSuccess: isRateDataSuccess,
    isLoading: isRateDataLoading,
  } = useYearlyTariffQuery<{
    results: {
      value_inc_vat: number;
      valid_from: string;
      valid_to: string;
      payment_method: null | string;
    }[];
  }>({
    tariff,
    type,
    gsp: value.gsp,
    fromDate: fromISODate,
    toDate: toISODate,
    category,
    enabled: !!deviceNumber && !!serialNo && !!category,
  });

  const {
    data: standingChargeData,
    isSuccess: isStandingChargeDataSuccess,
    isLoading: isStandingChargeDataLoading,
  } = useQuery<{
    results: {
      value_inc_vat: number;
      valid_from: string;
      valid_to: null | string;
      payment_method: null | string;
    }[];
  }>({
    queryKey: [
      "getStandingCharge",
      tariff,
      type,
      value.gsp,
      fromISODate,
      toISODate,
    ],
    queryFn: queryFnStandingChargeData,
    enabled: !!value.gsp && !!deviceNumber && !!serialNo && !!category,
  });

  const flattenedRateData = {
    results:
      rateData?.reduce(
        (
          acc: {
            value_inc_vat: number;
            valid_from: string;
            valid_to: string;
            payment_method: null | string;
          }[],
          monthlyRateData
        ) => {
          return [...acc, ...monthlyRateData.results];
        },
        []
      ) ?? [],
  };

  if (
    isSuccess &&
    isRateDataSuccess &&
    isStandingChargeDataSuccess &&
    caps.data
  ) {
    if (results === "monthly") {
      const results = calculateMonthlyPrices(
        type,
        category,
        value.gasConversionFactor,
        toISODate,
        caps.data.filter((d) => d.Region === `_${value.gsp}`),
        consumptionData,
        flattenedRateData,
        standingChargeData
      );
      return results;
    } else {
      const results = calculatePrice(
        type,
        category,
        value.gasConversionFactor,
        caps.data,
        consumptionData,
        flattenedRateData,
        standingChargeData
      );
      return results;
    }
  }
  return {
    cost: null,
    totalUnit: 0,
    totalPrice: 0,
    totalStandingCharge: 0,
    isLoading: isLoading || isRateDataLoading,
  };
};

export default useConsumptionCalculation;

export const calculateMonthlyPrices = (
  type: Exclude<TariffType, "EG">,
  category: string,
  gasConversionFactor: number,
  toDate: string,
  caps: CapsTSVResult[],
  consumptionData: {
    results: {
      consumption: number;
      interval_start: string;
      interval_end: string;
    }[];
  },
  rateData: {
    results: {
      value_inc_vat: number;
      valid_from: string;
      valid_to: string;
      payment_method: null | string;
    }[];
  },
  standingChargeData: {
    results: {
      value_inc_vat: number;
      valid_from: string;
      valid_to: null | string;
      payment_method: null | string;
    }[];
  }
) => {
  let monthlyPricesInPound = [];
  let totalPrice = 0;
  let monthlyStandingCharge = 0;
  let totalStandingCharge = 0;
  let totalUnit = 0;
  let rateDataOffset = 0; // since there are GAPS in the consumption data (possibly due to consumption data not synced to the server), we need to check if the consumption data matches the following rate period with the offset
  let currentDay = 0;
  let currentMonth = new Intl.DateTimeFormat("en-GB", {
    year: "2-digit",
    month: "short",
  }).format(new Date(toDate));
  let currentRateIndex = 0;
  const consumptionMultiplier = type === "G" ? gasConversionFactor : 1;
  const filteredRateDataResults = rateData.results.filter(
    (d) => d.payment_method !== "NON_DIRECT_DEBIT"
  );

  for (let i = 0; i < consumptionData.results.length; i++) {
    if (
      new Intl.DateTimeFormat("en-GB", {
        year: "2-digit",
        month: "short",
      }).format(new Date(consumptionData.results[i].interval_start)) !==
      currentMonth
    ) {
      totalStandingCharge += monthlyStandingCharge;
      const monthlyCostPlusStandingChargeInPound: number =
        evenRound(totalPrice / 100, 2) +
        evenRound(totalStandingCharge / 100, 2) -
        monthlyPricesInPound.reduce((acc, cur) => {
          return acc + Object.values(cur)[0];
        }, 0);
      monthlyPricesInPound.push({
        [currentMonth]: evenRound(monthlyCostPlusStandingChargeInPound, 2),
      });
      currentMonth = new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "2-digit",
      }).format(new Date(consumptionData.results[i].interval_start));
      monthlyStandingCharge = 0;
    }

    totalUnit += consumptionData.results[i].consumption * consumptionMultiplier;

    if (category === "Fixed") {
      const currentPeriodTariff = filteredRateDataResults[0];
      totalPrice +=
        (currentPeriodTariff?.value_inc_vat ?? 0) *
        consumptionData.results[i].consumption *
        consumptionMultiplier;
    } else if (category === "SVT") {
      const currentPeriodTariff = filteredRateDataResults.find(
        (d) =>
          new Date(d.valid_from) <=
            new Date(consumptionData.results[i].interval_start) &&
          (d.valid_to === null || new Date(d.valid_to)) >=
            new Date(consumptionData.results[i].interval_start)
      );
      const currentPeriodTariffCap = caps.find(
        (cap) =>
          new Date(consumptionData.results[i].interval_start) >=
          new Date(cap.Date)
      );
      const currentUnitRate =
        (currentPeriodTariff?.value_inc_vat ?? 0) >
        Number(currentPeriodTariffCap?.[type] ?? 0)
          ? Number(currentPeriodTariffCap?.[type] ?? 0)
          : currentPeriodTariff?.value_inc_vat ?? 0;
      totalPrice +=
        currentUnitRate *
        consumptionData.results[i].consumption *
        consumptionMultiplier;
    } else if (category === "Go" || category === "Cosy") {
      for (let j = currentRateIndex; j < filteredRateDataResults.length; j++) {
        const currentRateEntry = filteredRateDataResults[j];
        if (
          new Date(currentRateEntry.valid_from) <=
            new Date(consumptionData.results[i].interval_start) &&
          (filteredRateDataResults[j].valid_to === null ||
            new Date(currentRateEntry.valid_to)) >=
            new Date(consumptionData.results[i].interval_start)
        ) {
          totalPrice +=
            (currentRateEntry?.value_inc_vat ?? 0) *
            consumptionData.results[i].consumption *
            consumptionMultiplier;
          break;
        }
        currentRateIndex++;
      }
    } else {
      if (
        new Date(
          filteredRateDataResults[i + rateDataOffset]?.valid_from
        ).valueOf() ===
        new Date(consumptionData.results[i].interval_start).valueOf()
      ) {
        totalPrice +=
          filteredRateDataResults[i + rateDataOffset].value_inc_vat *
          consumptionData.results[i].consumption *
          consumptionMultiplier;
      } else {
        for (let j = 1; j < consumptionData.results.length; j++) {
          if (
            new Date(
              filteredRateDataResults[i + rateDataOffset + j]?.valid_from
            ).valueOf() ===
            new Date(consumptionData.results[i].interval_start).valueOf()
          ) {
            totalPrice +=
              filteredRateDataResults[i + rateDataOffset + j].value_inc_vat *
              consumptionData.results[i].consumption *
              consumptionMultiplier;
            rateDataOffset += j;
            break;
          }
        }
      }
    }

    if (
      new Date(consumptionData.results[i].interval_start).setHours(
        0,
        0,
        0,
        0
      ) !== currentDay
    ) {
      currentDay = new Date(consumptionData.results[i].interval_start).setHours(
        0,
        0,
        0,
        0
      );
      let standingCharge = 0;
      if (category === "Fixed") {
        standingCharge = standingChargeData.results[0]?.value_inc_vat ?? 0;
      } else {
        standingCharge =
          standingChargeData.results
            .filter((d) => d.payment_method !== "NON_DIRECT_DEBIT")
            .find(
              (d) =>
                new Date(d.valid_from) <= new Date(currentDay) &&
                (d.valid_to === null ||
                  new Date(d.valid_to) >= new Date(currentDay))
            )?.value_inc_vat ?? 0;
      }
      monthlyStandingCharge += standingCharge;
    }
  }

  // add the last month data
  totalStandingCharge += monthlyStandingCharge;
  const monthlyCostPlusStandingChargeInPound: number =
    evenRound(totalPrice / 100, 2) +
    evenRound(totalStandingCharge / 100, 2) -
    monthlyPricesInPound.reduce((acc, cur) => {
      return acc + Object.values(cur)[0];
    }, 0);
  monthlyPricesInPound.push({
    [currentMonth]: evenRound(monthlyCostPlusStandingChargeInPound, 2),
  });

  totalStandingCharge = evenRound(totalStandingCharge, 2);
  return {
    cost: monthlyPricesInPound,
    totalUnit,
    totalPrice,
    totalStandingCharge,
    isLoading: false,
  };
};

export const calculatePrice = (
  type: Exclude<TariffType, "EG">,
  category: string,
  gasConversionFactor: number,
  caps: CapsTSVResult[],
  consumptionData: {
    results: {
      consumption: number;
      interval_start: string;
      interval_end: string;
    }[];
  },
  rateData: {
    results: {
      value_inc_vat: number;
      valid_from: string;
      valid_to: string;
      payment_method: null | string;
    }[];
  },
  standingChargeData: {
    results: {
      value_inc_vat: number;
      valid_from: string;
      valid_to: null | string;
      payment_method: null | string;
    }[];
  }
) => {
  let totalPrice = 0;
  let totalUnit = 0;
  let totalStandingCharge = 0;
  let rateDataOffset = 0; // since there are GAPS in the consumption data (possibly due to consumption data not synced to the server), we need to check if the consumption data matches the following rate period with the offset
  let currentDay = 0;
  let currentRateIndex = 0;
  const consumptionMultiplier = type === "G" ? gasConversionFactor : 1;
  const filteredRateDataResults = rateData.results.filter(
    (d) => d.payment_method !== "NON_DIRECT_DEBIT"
  );

  for (let i = 0; i < consumptionData.results.length; i++) {
    totalUnit += consumptionData.results[i].consumption * consumptionMultiplier;

    if (category === "Fixed") {
      const currentPeriodTariff = filteredRateDataResults[0];
      totalPrice +=
        (currentPeriodTariff?.value_inc_vat ?? 0) *
        consumptionData.results[i].consumption *
        consumptionMultiplier;
    } else if (category === "SVT") {
      const currentPeriodTariff = filteredRateDataResults.find(
        (d) =>
          new Date(d.valid_from) <=
            new Date(consumptionData.results[i].interval_start) &&
          (d.valid_to === null || new Date(d.valid_to)) >=
            new Date(consumptionData.results[i].interval_start)
      );
      const currentPeriodTariffCap = caps.find(
        (cap) =>
          new Date(consumptionData.results[i].interval_start) >=
          new Date(cap.Date)
      );
      const currentUnitRate =
        (currentPeriodTariff?.value_inc_vat ?? 0) >
        Number(currentPeriodTariffCap?.[type] ?? 0)
          ? Number(currentPeriodTariffCap?.[type] ?? 0)
          : currentPeriodTariff?.value_inc_vat ?? 0;
      totalPrice +=
        currentUnitRate *
        consumptionData.results[i].consumption *
        consumptionMultiplier;
    } else if (category === "Go" || category === "Cosy") {
      for (let j = currentRateIndex; j < filteredRateDataResults.length; j++) {
        const currentRateEntry = filteredRateDataResults[j];
        if (
          new Date(currentRateEntry.valid_from) <=
            new Date(consumptionData.results[i].interval_start) &&
          (filteredRateDataResults[j].valid_to === null ||
            new Date(currentRateEntry.valid_to)) >=
            new Date(consumptionData.results[i].interval_start)
        ) {
          totalPrice +=
            (currentRateEntry?.value_inc_vat ?? 0) *
            consumptionData.results[i].consumption *
            consumptionMultiplier;
          break;
        }
        currentRateIndex++;
      }
    } else {
      if (
        new Date(
          filteredRateDataResults[i + rateDataOffset]?.valid_from
        ).valueOf() ===
        new Date(consumptionData.results[i].interval_start).valueOf()
      ) {
        totalPrice +=
          filteredRateDataResults[i + rateDataOffset].value_inc_vat *
          consumptionData.results[i].consumption *
          consumptionMultiplier;
      } else {
        for (let j = 1; j < consumptionData.results.length; j++) {
          if (
            new Date(
              filteredRateDataResults[i + rateDataOffset + j]?.valid_from
            ).valueOf() ===
            new Date(consumptionData.results[i].interval_start).valueOf()
          ) {
            totalPrice +=
              filteredRateDataResults[i + rateDataOffset + j].value_inc_vat *
              consumptionData.results[i].consumption *
              consumptionMultiplier;
            rateDataOffset += j;
            break;
          }
        }
      }
    }

    if (
      new Date(consumptionData.results[i].interval_start).setHours(
        0,
        0,
        0,
        0
      ) !== currentDay
    ) {
      currentDay = new Date(consumptionData.results[i].interval_start).setHours(
        0,
        0,
        0,
        0
      );
      let standingCharge = 0;
      if (category === "Fixed") {
        standingCharge = standingChargeData.results[0]?.value_inc_vat ?? 0;
      } else {
        standingCharge =
          standingChargeData.results
            .filter((d) => d.payment_method !== "NON_DIRECT_DEBIT")
            .find(
              (d) =>
                new Date(d.valid_from) <= new Date(currentDay) &&
                (d.valid_to === null ||
                  new Date(d.valid_to) >= new Date(currentDay))
            )?.value_inc_vat ?? 0;
      }
      totalStandingCharge += standingCharge;
    }
  }

  // if consumption data is NOT enough for the whole year (mutliply by proportion)
  if (category === "Agile") {
    if (consumptionData.results.length < 365 * 48) {
      totalPrice = (totalPrice * 365 * 48) / consumptionData.results.length;
      totalStandingCharge =
        (totalStandingCharge * 365 * 48) / consumptionData.results.length;
    }
  } else {
    if (consumptionData.results.length < 365) {
      totalPrice = (totalPrice * 365) / consumptionData.results.length;
      totalStandingCharge =
        (totalStandingCharge * 365) / consumptionData.results.length;
    }
  }
  totalPrice = evenRound(totalPrice / 100, 2);
  totalStandingCharge = evenRound(totalStandingCharge / 100, 2);

  /* temporarily increase price for tracker since 11/12/2023 price increase */
  if (category === "Tracker") {
    totalPrice = totalPrice * 1.05;
    if (type === "E") totalStandingCharge = totalStandingCharge * 1.15;
    if (type === "G") totalStandingCharge = totalStandingCharge * 1.02;
  }

  return {
    cost: totalPrice + totalStandingCharge,
    totalUnit,
    totalPrice,
    totalStandingCharge,
    isLoading: false,
  };
};
