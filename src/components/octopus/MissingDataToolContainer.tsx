"use client";

import { UserContext } from "@/context/user";
import { useContext, useState } from "react";

import PeriodMonthSelector, { getDatePeriod } from "./PeriodMonthSelector";

import Loading from "@/app/loading";

import { IPeriod } from "@/data/source";
import useConsumptionData from "@/hooks/useConsumptionData";
import useTypeTabs from "@/hooks/useTypeTabs";
import { AiFillFire } from "react-icons/ai";
import { BsLightningChargeFill } from "react-icons/bs";
import { PiSunDimFill } from "react-icons/pi";
import MissingDataToolChart from "./MissingDataToolChart";

export type ErrorType = Record<string, string>;

const MissingDataToolContainer = () => {
  const { value } = useContext(UserContext);

  const [period, setPeriod] = useState<IPeriod>(getDatePeriod("month"));

  const { currentType, Tabs } = useTypeTabs();

  const hasEImport = !!(value.ESerialNo && value.MPAN);
  const hasEExport = !!(value.EESerialNo && value.EMPAN);
  const hasGImport = !!(value.GSerialNo && value.MPAN);

  const toDate = new Date(new Date().setDate(new Date().getDate() - 1)); // yesterday
  toDate.setHours(23, 59, 59, 999);

  const fromDate = new Date(new Date().setFullYear(toDate.getFullYear() - 1)); // 1st of Month of 1 year before
  fromDate.setDate(1);
  fromDate.setHours(0, 0, 0, 0);

  /* get data from API */
  const { data: dataEImport, isLoading } = useConsumptionData({
    fromISODate: fromDate.toISOString(),
    toISODate: toDate.toISOString(),
    type: "E",
    category: "Agile",
    deviceNumber: value.MPAN,
    serialNo: value.ESerialNo,
    apiKey: value.apiKey,
  });

  const { data: dataEExport } = useConsumptionData({
    fromISODate: fromDate.toISOString(),
    toISODate: toDate.toISOString(),
    type: "E",
    category: "Agile",
    deviceNumber: value.EMPAN,
    serialNo: value.EESerialNo,
    apiKey: value.apiKey,
  });

  const { data: dataGImport } = useConsumptionData({
    fromISODate: fromDate.toISOString(),
    toISODate: toDate.toISOString(),
    type: "G",
    category: "Agile",
    deviceNumber: value.MPRN,
    serialNo: value.GSerialNo,
    apiKey: value.apiKey,
  });

  const fromDateWithin1Year =
    new Date(period.from).valueOf() < new Date(fromDate).valueOf()
      ? fromDate
      : period.from;
  const toDateWithin1Year =
    new Date(period.to).valueOf() > new Date(toDate).valueOf()
      ? toDate
      : period.to;

  /* loading while waiting */
  if (!hasEImport && !hasEExport && !hasGImport) return <Loading />;
  if (hasEImport && !dataEImport) return <Loading />;
  if (hasEExport && !dataEExport) return <Loading />;
  if (hasGImport && !dataGImport) return <Loading />;

  return (
    <div className="flex flex-col justify-between gap-4">
      <div className="flex items-start flex-wrap">
        <PeriodMonthSelector
          period={period}
          setPeriod={setPeriod}
          hasDaysOfWeek={true}
        />
      </div>
      <div className="flex flex-col">
        <Tabs />
        <div className="flex w-full border-l border-r border-b border-accentPink-900 rounded-b-xl p-6">
          {currentType === "EE" && (
            <MissingDataToolChart
              fromDate={fromDateWithin1Year}
              toDate={toDateWithin1Year}
              data={dataEExport}
              type="EE"
              contractFrom={value.contractEEStartDate}
            >
              <PiSunDimFill className="w-8 h-8 fill-accentPink-700 inline-block mr-2" />
              Electricity (Export) Data
            </MissingDataToolChart>
          )}
          {currentType === "E" && (
            <MissingDataToolChart
              fromDate={fromDateWithin1Year}
              toDate={toDateWithin1Year}
              data={dataEImport}
              type="E"
              contractFrom={value.contractEStartDate}
            >
              <BsLightningChargeFill className="w-8 h-8 fill-accentPink-700 inline-block mr-2" />
              Electricity Smart Meter Data
            </MissingDataToolChart>
          )}
          {currentType === "G" && (
            <MissingDataToolChart
              fromDate={fromDateWithin1Year}
              toDate={toDateWithin1Year}
              data={dataGImport}
              type="G"
              contractFrom={value.contractGStartDate}
            >
              <AiFillFire className="w-8 h-8 fill-accentPink-700 inline-block mr-2" />
              Gas Smart Meter Data
            </MissingDataToolChart>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissingDataToolContainer;
