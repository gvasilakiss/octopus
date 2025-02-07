"use client";

import { IMeterPointE, IMeterPointG, IUserApiResult } from "@/data/source";
import { getGsp } from "@/utils/helpers";
import { useQuery } from "@tanstack/react-query";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";

export type TContract =
  | {
      tariff_code: string;
      valid_from: string;
      valid_to: string;
    }
  | undefined;
export interface IUserValue {
  postcode: string;
  gsp: string;
  apiKey: string;
  accountNumber: string;
  gasConversionFactor: number;
  trackerCode: string;
  agileCode: string;
  MPAN: string;
  ESerialNo: string;
  ESerialNos: string[];
  currentETariff: string;
  MPRN: string;
  GSerialNo: string;
  GSerialNos: string[];
  currentGTariff: string;
  EMPAN: string;
  EESerialNo: string;
  EESerialNos: string[];
  currentEETariff: string;
  error: string;
  currentEContract: undefined | TContract;
  currentGContract: undefined | TContract;
  currentEEContract: undefined | TContract;
  previousEContract: undefined | TContract;
  previousGContract: undefined | TContract;
  previousEEContract: undefined | TContract;
  contractGStartDate: undefined | string;
  contractEStartDate: undefined | string;
  contractEEStartDate: undefined | string;
  agreementsEE: undefined | IMeterPointE["agreements"];
  agreementsE: undefined | IMeterPointE["agreements"];
  agreementsG: undefined | IMeterPointG["agreements"];
  configBattery: {
    hasBattery: boolean;
    capacity: number;
    efficiency: number;
    rate: number;
  };
  configSolar: {
    hasSolar: boolean;
    annualProduction: number;
    rate: number;
  };
}

export const initialValue = {
  value: {
    postcode: "",
    gsp: "A",
    apiKey: "",
    accountNumber: "",
    gasConversionFactor: 11.1,
    trackerCode: "",
    agileCode: "",
    MPAN: "",
    ESerialNo: "",
    ESerialNos: [],
    currentETariff: "",
    EMPAN: "",
    EESerialNo: "",
    EESerialNos: [],
    currentEETariff: "",
    MPRN: "",
    GSerialNo: "",
    GSerialNos: [],
    currentGTariff: "",
    error: "",
    currentEContract: undefined,
    currentGContract: undefined,
    currentEEContract: undefined,
    previousEContract: undefined,
    previousGContract: undefined,
    previousEEContract: undefined,
    contractGStartDate: undefined,
    contractEStartDate: undefined,
    contractEEStartDate: undefined,
    agreementsE: undefined,
    agreementsEE: undefined,
    agreementsG: undefined,
    configBattery: {
      hasBattery: false,
      capacity: 0,
      efficiency: 0.9,
      rate: 0,
    },
    configSolar: {
      hasSolar: false,
      annualProduction: 0,
      rate: 0,
    },
  } as IUserValue,
  setValue: (value: IUserValue) => {},
};

export const UserContext = createContext(initialValue);

export const UserContextProvider = ({ children }: PropsWithChildren) => {
  const [value, setValue] = useState<IUserValue>(initialValue.value);

  // get account info
  const queryFn = async () => {
    try {
      const response = await fetch(
        `https://api.octopus.energy/v1/accounts/${value.accountNumber}`,
        {
          method: "POST",
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
        throw new Error(
          `Sorry, we have an error with your info: ${err.message}. Please check if your info are correct.`
        );
      throw new Error("Sorry, the request was unsuccessful");
    }
  };

  const { data, isSuccess, isLoading, error, isError } =
    useQuery<IUserApiResult>({
      queryKey: ["user", value.accountNumber, value.apiKey],
      queryFn,
      enabled: !!value.accountNumber && !!value.apiKey,
      retry: false,
    });

  const currentProperty = useMemo(
    () =>
      data?.properties?.filter(
        (property) => property.moved_out_at === null
      )?.[0],
    [data]
  );

  const agreementsE = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => !meter_point.is_export)
        ?.at(-1)?.agreements,
    [currentProperty]
  );

  const agreementsEE = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => meter_point.is_export)
        ?.at(-1)?.agreements,
    [currentProperty]
  );

  const agreementsG = useMemo(
    () => currentProperty?.gas_meter_points?.at(-1)?.agreements,
    [currentProperty]
  );

  const currentEContract = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => !meter_point.is_export)
        ?.at(-1)
        ?.agreements.filter(
          (agreement) =>
            agreement.valid_to === null ||
            new Date(agreement.valid_to).valueOf() > new Date().valueOf()
        )?.[0],
    [currentProperty]
  );

  const previousEContract = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => !meter_point.is_export)
        ?.at(-1)
        ?.agreements.filter(
          (agreement) => agreement.valid_to === currentEContract?.valid_from
        )?.[0],
    [currentProperty, currentEContract]
  );

  const contractEStartDate = useMemo(() => {
    const agreements = currentProperty?.electricity_meter_points
      ?.filter((meter_point) => !meter_point.is_export)
      ?.at(-1)?.agreements;
    if (agreements && agreements?.length > 0) {
      const earliestAgreement = [...agreements];
      earliestAgreement.sort(
        (a, b) =>
          new Date(a.valid_from).valueOf() - new Date(b.valid_from).valueOf()
      );
      return earliestAgreement[0].valid_from;
    }
  }, [currentProperty]);

  const contractEEStartDate = useMemo(() => {
    const agreements = currentProperty?.electricity_meter_points
      ?.filter((meter_point) => meter_point.is_export)
      ?.at(-1)?.agreements;
    if (agreements && agreements?.length > 0) {
      const earliestAgreement = [...agreements];
      earliestAgreement.sort(
        (a, b) =>
          new Date(a.valid_from).valueOf() - new Date(b.valid_from).valueOf()
      );
      return earliestAgreement[0].valid_from;
    }
  }, [currentProperty]);

  const contractGStartDate = useMemo(() => {
    const agreements = currentProperty?.gas_meter_points?.at(-1)?.agreements;
    if (agreements && agreements?.length > 0) {
      const earliestAgreement = [...agreements];
      earliestAgreement.sort(
        (a, b) =>
          new Date(a.valid_from).valueOf() - new Date(b.valid_from).valueOf()
      );
      return earliestAgreement[0].valid_from;
    }
  }, [currentProperty]);

  const MPAN =
    data?.properties
      ?.filter((property) => property.moved_out_at === null)?.[0]
      ?.electricity_meter_points?.filter(
        (meter_point) => !meter_point.is_export
      )
      ?.at(-1)?.mpan ?? "";
  const ESerialNo =
    value.ESerialNo === ""
      ? data?.properties
          ?.filter((property) => property.moved_out_at === null)?.[0]
          ?.electricity_meter_points?.filter(
            (meter_point) => !meter_point.is_export
          )
          ?.at(-1)
          ?.meters?.at(-1)?.serial_number ?? ""
      : value.ESerialNo;
  const ESerialNos = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => !meter_point.is_export)
        ?.at(-1)
        ?.meters?.map((meter) => meter.serial_number) ?? [],
    [currentProperty]
  );
  const currentETariff = currentEContract?.tariff_code.slice(5, -2) ?? "";

  const currentEEContract = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => meter_point.is_export)
        ?.at(-1)
        ?.agreements.filter(
          (agreement) =>
            agreement.valid_to === null ||
            new Date(agreement.valid_to).valueOf() > new Date().valueOf()
        )?.[0],
    [currentProperty]
  );

  const previousEEContract = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => meter_point.is_export)
        ?.at(-1)
        ?.agreements.filter(
          (agreement) => agreement.valid_to === currentEEContract?.valid_from
        )?.[0],
    [currentProperty, currentEEContract]
  );

  const EMPAN =
    currentProperty?.electricity_meter_points
      ?.filter((meter_point) => meter_point.is_export)
      ?.at(-1)?.mpan ?? "";
  const EESerialNo =
    value.EESerialNo === ""
      ? currentProperty?.electricity_meter_points
          ?.filter((meter_point) => meter_point.is_export)
          ?.at(-1)
          ?.meters?.at(-1)?.serial_number ?? ""
      : value.ESerialNo;
  const EESerialNos = useMemo(
    () =>
      currentProperty?.electricity_meter_points
        ?.filter((meter_point) => meter_point.is_export)
        ?.at(-1)
        ?.meters?.map((meter) => meter.serial_number) ?? [],
    [currentProperty]
  );
  const currentEETariff = currentEEContract?.tariff_code.slice(5, -2) ?? "";

  const currentGContract = useMemo(
    () =>
      currentProperty?.gas_meter_points
        ?.at(-1)
        ?.agreements.filter(
          (agreement) =>
            agreement.valid_to === null ||
            new Date(agreement.valid_to).valueOf() > new Date().valueOf()
        )?.[0],
    [currentProperty]
  );
  const previousGContract = useMemo(
    () =>
      currentProperty?.gas_meter_points
        ?.at(-1)
        ?.agreements.filter(
          (agreement) => agreement.valid_to === currentGContract?.valid_from
        )?.[0],
    [currentProperty, currentGContract]
  );

  const MPRN = currentProperty?.gas_meter_points?.at(-1)?.mprn ?? "";
  const GSerialNo =
    value.GSerialNo === ""
      ? currentProperty?.gas_meter_points?.at(-1)?.meters?.at(0)
          ?.serial_number ?? ""
      : value.GSerialNo;
  const GSerialNos = useMemo(
    () =>
      currentProperty?.gas_meter_points
        ?.at(-1)
        ?.meters?.map((meter) => meter.serial_number) ?? [],
    [currentProperty]
  );
  const currentGTariff = currentGContract?.tariff_code.slice(5, -2) ?? "";

  const postcode = currentProperty?.postcode;

  useEffect(() => {
    const storedValue = window.localStorage.getItem("octoprice");
    if (storedValue && storedValue !== "undefined")
      setValue({ ...initialValue.value, ...JSON.parse(storedValue) });
  }, []);

  useEffect(() => {
    if (isSuccess && postcode && postcode !== value.postcode) {
      getGsp(postcode)
        .then((gsp) => {
          if (gsp !== false)
            setValue({
              ...value,
              postcode: postcode.toUpperCase(),
              gsp: gsp.replace("_", ""),
            });
        })
        .catch((error: unknown) => {
          if (error instanceof Error) throw new Error(error.message);
        });
    }
  }, [isSuccess, postcode, setValue, value]);

  useEffect(() => {
    if (value.postcode) {
      getGsp(value.postcode)
        .then((gsp) => {
          if (gsp !== false)
            setValue((value) => ({
              ...value,
              gsp: gsp.replace("_", ""),
            }));
        })
        .catch((error: unknown) => {
          if (error instanceof Error) throw new Error(error.message);
        });
    }
  }, [postcode, value.postcode]);

  useEffect(() => {
    if (isSuccess)
      setValue((value) => ({
        ...value,
        MPAN,
        ESerialNo,
        ESerialNos,
        EMPAN,
        EESerialNo,
        EESerialNos,
        MPRN,
        GSerialNo,
        GSerialNos,
        currentEContract,
        previousEContract,
        currentETariff,
        currentGContract,
        previousGContract,
        currentGTariff,
        currentEEContract,
        previousEEContract,
        currentEETariff,
        contractEStartDate,
        contractEEStartDate,
        contractGStartDate,
        agreementsE,
        agreementsEE,
        agreementsG,
        trackerCode: currentETariff.includes("SILVER")
          ? currentETariff
          : value.trackerCode,
        agileCode: currentETariff.includes("AGILE")
          ? currentETariff
          : value.agileCode,
      }));
  }, [
    EESerialNo,
    EESerialNos,
    EMPAN,
    ESerialNo,
    ESerialNos,
    GSerialNo,
    GSerialNos,
    MPAN,
    MPRN,
    currentEContract,
    currentEEContract,
    currentEETariff,
    currentETariff,
    currentGContract,
    currentGTariff,
    contractEStartDate,
    isSuccess,
    setValue,
    contractEEStartDate,
    contractGStartDate,
    previousEContract,
    previousGContract,
    previousEEContract,
    agreementsE,
    agreementsEE,
    agreementsG,
  ]);

  // need to handle existing users with saved data
  const handleSetValue = useCallback((value: IUserValue) => {
    window.localStorage.setItem("octoprice", JSON.stringify(value));
    setValue(value);
  }, []);

  /* error handling */
  if (
    !value.error &&
    isSuccess &&
    !(MPAN || ESerialNo) &&
    !(MPRN || GSerialNo)
  ) {
    setValue({
      ...value,
      error:
        "Sorry, owing to technical limitations, Octo cannot retrive your data at the moment. Please try again later.",
    });
  }

  if (
    !value.error &&
    isSuccess &&
    typeof currentEContract === undefined &&
    typeof currentGContract === undefined
  ) {
    setValue({
      ...value,
      error:
        "Sorry, owing to technical limitations, Octo cannot retrive your data at the moment. Please try again later.",
    });
  }

  if (error) {
    toast.error(error.message);
  }

  return (
    <UserContext.Provider value={{ value, setValue: handleSetValue }}>
      {children}
    </UserContext.Provider>
  );
};
