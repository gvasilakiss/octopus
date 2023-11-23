"use client";

import Loading from "@/components/Loading";
import Badge from "@/components/octopus/Badge";
import Comparison from "@/components/octopus/Comparison";
import Remark from "./Remark";

import {
  QueryTariffResult,
  TariffResult,
  TariffType,
  priceCap,
} from "@/data/source";

import useTariffQuery from "../../hooks/useTariffQuery";

import {
  calculateChangePercentage,
  isSameDate,
  isToday,
  priceAccessor,
} from "../../utils/helpers";

import backgroundE from "../../../public/images/E.jpg";
import backgroundG from "../../../public/images/G.jpg";
import ErrorMessage from "./ErrorMessage";
import { EnergyIcon } from "./EnergyIcon";

const PricePane = ({
  tariff,
  type,
  gsp,
}: {
  tariff: string;
  type: Exclude<TariffType, "EG">;
  gsp: string;
}) => {
  const { isLoading, isError, isSuccess, refetch, data, error } =
    useTariffQuery<QueryTariffResult>({
      tariff,
      type,
      gsp,
    });

  const results = data?.[0]?.results ?? [];

  const priceTodayIndex = results.findIndex((data) =>
    isToday(new Date(data.valid_from))
  );
  const priceYesterdayIndex = results.findIndex((data) =>
    isSameDate(
      new Date(new Date().setDate(new Date().getDate() - 1)),
      new Date(data.valid_from)
    )
  );

  const noPriceTomorrowMessage =
    "The rate of tomorrow is usually available between 11.00am and 6.00pm. Please revisit this page later to get the updates.";

  const [priceYesterdayDisplay] = getPriceDisplay(
    priceTodayIndex,
    priceYesterdayIndex,
    "yesterday",
    results,
    type
  );
  const [priceTodayDisplay, priceChangeToday] = getPriceDisplay(
    priceTodayIndex,
    priceYesterdayIndex,
    "today",
    results,
    type
  );
  const [_, priceChangeTodayVsPriceCap] = getPriceDisplay(
    priceTodayIndex,
    priceYesterdayIndex,
    "todayVsPriceCap",
    results,
    type
  );
  const [priceTomorrowDisplay, priceChangeTomorrow] = getPriceDisplay(
    priceTodayIndex,
    priceYesterdayIndex,
    "tomorrow",
    results,
    type,
    noPriceTomorrowMessage
  );

  return (
    <div
      className="relative flex-1 flex flex-col gap-8 min-h-[250px] md:min-h-[300px] rounded-xl p-4 bg-theme-950 border border-accentPink-800/60 shadow-inner bg-gradient-to-br from-transparent via-theme-800/20 to-purple-600/30 bg-cover"
      style={{
        backgroundImage: `linear-gradient(0deg, rgba(0,3,35,0.7) 30% , rgba(0,3,35,0.9) 70%, rgba(0,4,51,1) 100% ),url(${
          type === "E" ? backgroundE.src : backgroundG.src
        })`,
      }}
    >
      {isLoading && <Loading />}
      {isError && <ErrorMessage error={error} errorHandler={() => refetch()} />}
      {isSuccess && (
        <>
          <EnergyIcon type={type} />
          <div className="flex flex-1 self-start flex-col">
            <Badge
              label={`Today - ${new Date().toLocaleDateString()}`}
              variant="secondary"
            />
            <div className="font-digit text-6xl text-white flex flex-col items-start gap-1">
              <div>{priceTodayDisplay}</div>
              <div className="flex">
                {typeof priceChangeToday === "number" && (
                  <Comparison change={priceChangeToday} compare="yesterday" />
                )}
                {typeof priceChangeTodayVsPriceCap === "number" && (
                  <Comparison
                    change={priceChangeTodayVsPriceCap}
                    compare="Ofgem cap"
                  >
                    <Remark variant="badge">
                      The{" "}
                      <a
                        href="https://www.ofgem.gov.uk/energy-price-cap"
                        target="_blank"
                      >
                        Ofgem Price Cap
                      </a>{" "}
                      is currently{" "}
                      <strong className="text-bold">
                        {`${priceCap[type]}p`}
                      </strong>{" "}
                      (from 1 October to 31 December 2023). But note that
                      Tracker has much higher cap.
                    </Remark>
                  </Comparison>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between items-start">
            <div className="flex justify-center items-start flex-col">
              <Badge label="Yesterday" variant="secondary" />
              <div className="font-digit font-thin text-center text-3xl text-white flex justify-center items-end">
                {priceYesterdayDisplay}
              </div>
            </div>

            <div className="flex justify-center items-start flex-col">
              <Badge label="Tomorrow" variant="secondary" />
              <div className="font-digit text-center text-3xl text-white flex justify-center items-end">
                {priceTomorrowDisplay}
                {typeof priceChangeTomorrow === "number" && (
                  <Comparison change={priceChangeTomorrow} compare="today" />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PricePane;

const getPriceDisplay = (
  priceTodayIndex: number | undefined,
  priceYesterdayIndex: number | undefined,
  priceDisplayDate: "today" | "yesterday" | "tomorrow" | "todayVsPriceCap",
  results: TariffResult[],
  type: keyof typeof priceCap,
  message = "Sorry, the price is currently unavailable, please check back later."
) => {
  let display = (
    <>
      --
      <Remark>{message}</Remark>
    </>
  );
  let changeVsPrevDay: boolean | number = false;
  let price: string | number = "--";
  let priceToCompare: string | number = "--";

  if (
    priceTodayIndex !== undefined &&
    priceYesterdayIndex !== undefined &&
    priceYesterdayIndex !== 0
  ) {
    const indexToAccessMap = {
      yesterday: priceYesterdayIndex,
      today: priceTodayIndex,
      tomorrow: priceTodayIndex - 1,
      todayVsPriceCap: priceTodayIndex,
    };
    const comparePriceMap = {
      yesterday: null,
      today: priceAccessor(results, priceYesterdayIndex),
      tomorrow: priceAccessor(results, priceTodayIndex),
      todayVsPriceCap: priceCap[type],
    };
    const indexToAccess = indexToAccessMap[priceDisplayDate];

    if (typeof indexToAccess === "number" && indexToAccess >= 0)
      price = priceAccessor(results, indexToAccess) ?? "--";
    const priceToCompare = comparePriceMap[priceDisplayDate];

    changeVsPrevDay = calculateChangePercentage(price, priceToCompare);

    if (typeof price === "number")
      display = (
        <>
          {price}
          <span className="text-sm font-thin font-sans pl-1">p</span>
        </>
      );
  }

  return [display, changeVsPrevDay] as const;
};
