"use client";

import Loading from "@/components/Loading";
import { ETARIFFS, GTARIFFS, TariffCategory } from "@/data/source";
import { useCallback, useState } from "react";
import NotCurrentlySupported from "./NotCurrentlySupported";
import Remark from "./Remark";
import TariffComparisionCard from "./TariffComparisionCard";
import TariffComparisionCardsContainer from "./TariffComparisionCardsContainer";

import useAccountDetails from "@/hooks/useAccountDetails";
import { AiFillFire } from "react-icons/ai";
import { BsLightningChargeFill } from "react-icons/bs";
import AddATariff from "./AddATariffToCompare";

const UserApiResult = () => {
  const [tariffsEToCompare, setTariffsEToCompare] = useState(
    ETARIFFS.slice(0, 3)
  );
  const [tariffsGToCompare, setTariffsGToCompare] = useState(GTARIFFS);

  const addToTariff = (tariffToAdd: (typeof ETARIFFS)[number]["tariff"]) => {
    setTariffsEToCompare((tariffsEToCompare) => {
      const newTariff = ETARIFFS.find(
        (tariff) => tariff.tariff === tariffToAdd
      );
      if (newTariff) return [...tariffsEToCompare, newTariff];
      return tariffsEToCompare;
    });
  };
  const setECost = useCallback(
    (category: TariffCategory, cost: number) =>
      setTariffsEToCompare((value) =>
        value.map((tariffSet) => {
          if (tariffSet.category === category) {
            return { ...tariffSet, cost };
          }
          return tariffSet;
        })
      ),
    []
  );
  const setGCost = useCallback(
    (category: TariffCategory, cost: number) =>
      setTariffsGToCompare((value) =>
        value.map((tariffSet) => {
          if (tariffSet.category === category) {
            return { ...tariffSet, cost };
          }
          return tariffSet;
        })
      ),
    []
  );

  const {
    data,
    isSuccess,
    isLoading,
    error,
    isError,
    MPAN,
    ESerialNo,
    MPRN,
    GSerialNo,
  } = useAccountDetails();

  const yesterday = new Date(
    new Date(new Date().setHours(23, 59, 59, 999)).setDate(
      new Date().getDate() - 1
    )
  ).toISOString();
  const oneYearEarlier = new Date(
    new Date(new Date().setHours(0, 0, 0, 0)).setFullYear(
      new Date().getFullYear() - 1
    )
  ).toISOString();

  const SVTECost =
    tariffsEToCompare.find((tariffSet) => tariffSet.category === "SVT")?.cost ??
    null;
  const SVTGCost =
    tariffsGToCompare.find((tariffSet) => tariffSet.category === "SVT")?.cost ??
    null;

  if (
    isSuccess &&
    data &&
    (data.properties.length !== 1 ||
      data.properties[0].electricity_meter_points.length > 1 ||
      data.properties[0].gas_meter_points.length > 1)
  ) {
    return (
      <NotCurrentlySupported>
        Sorry, currently addresses with more than 1 gas and 1 electricity meters
        are not supported.
      </NotCurrentlySupported>
    );
  }
  if (isSuccess && !(MPAN || ESerialNo) && !(MPRN || GSerialNo)) {
    return (
      <NotCurrentlySupported>
        Sorry, owing to technical limitations, Octo cannot retrive your data at
        the moment. Please try again later.
      </NotCurrentlySupported>
    );
  }
  const reOrderedTariffsEToCompare = [...tariffsEToCompare].sort(
    (a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity)
  );

  const reOrderedTariffsGToCompare = [...tariffsGToCompare].sort(
    (a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity)
  );

  const remainingTariffs = [...ETARIFFS].filter(
    (tariff) =>
      !tariffsEToCompare.map((tariff) => tariff.tariff).includes(tariff.tariff)
  );

  return (
    <div className="flex gap-4 flex-col relative">
      {isLoading && (
        <div className=" min-h-screen">
          <Loading />
        </div>
      )}
      {isError && error && <div>{error.message}</div>}
      {isSuccess && (
        <>
          <div className="flex gap-2 items-center  flex-col-reverse md:flex-col lg:flex-row">
            <div className="flex-grow">
              The following analysis is based on your actual energy use pattern
              in the past year, showing which tariff suits you best!
              <Remark>
                The figures presented here are an approximation of your annual
                energy costs. Approximations and assumptions are used in the
                calculations. The actual costs may vary a lot depending on the
                previaling unit rates and change of energy usage patterns.
                Remember, past results do not guarantee future performance.
              </Remark>
            </div>
          </div>
          {MPAN && ESerialNo && (
            <>
              <h2 className="font-display text-accentPink-500 text-4xl flex items-center mt-4">
                <BsLightningChargeFill className="w-8 h-8 fill-accentPink-900 inline-block mr-2" />
                Electricity
              </h2>
              <TariffComparisionCardsContainer>
                {reOrderedTariffsEToCompare.map(({ tariff, category }, ind) => (
                  <TariffComparisionCard
                    key={category}
                    type="E"
                    deviceNumber={MPAN}
                    serialNo={ESerialNo}
                    tariff={tariff}
                    category={category}
                    fromDate={oneYearEarlier}
                    toDate={yesterday}
                    compareTo={SVTECost}
                    setCost={setECost}
                    rank={ind + 1}
                  />
                ))}
                {remainingTariffs.length > 0 && (
                  <div
                    className={`basis-full lg:basis-[32%] xl:basis-[32.5%] relative border border-dashed border-white/30 min-h-[200px] lg:h-[300px] rounded-2xl flex flex-col justify-center items-center gap-2 bg-cover bg-tops`}
                  >
                    <AddATariff
                      tariffs={remainingTariffs}
                      addToTariff={addToTariff}
                    />
                  </div>
                )}
              </TariffComparisionCardsContainer>
            </>
          )}
          {MPRN && GSerialNo && (
            <>
              <h2 className="font-display text-accentPink-500 text-4xl flex items-center mt-8">
                <AiFillFire className="w-8 h-8 fill-accentPink-900 inline-block mr-2" />
                Gas
              </h2>
              <TariffComparisionCardsContainer>
                {reOrderedTariffsGToCompare.map(({ tariff, category }, ind) => (
                  <TariffComparisionCard
                    key={category}
                    type="G"
                    deviceNumber={MPRN}
                    serialNo={GSerialNo}
                    tariff={tariff}
                    category={category}
                    fromDate={oneYearEarlier}
                    toDate={yesterday}
                    compareTo={SVTGCost}
                    setCost={setGCost}
                    rank={ind + 1}
                  />
                ))}
              </TariffComparisionCardsContainer>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default UserApiResult;
