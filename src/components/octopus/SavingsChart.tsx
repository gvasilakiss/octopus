"use client";

import Image from "next/image";

import Badge from "@/components/octopus/Badge";
import Comparison from "@/components/octopus/Comparison";
import { ENERGY_TYPE, SVT_ETARIFF, TariffCategory } from "@/data/source";

import { toBlob, toJpeg } from "html-to-image";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";

import { evenRound } from "../../utils/helpers";

import useConsumptionCalculation from "@/hooks/useConsumptionCalculation";
import Lottie from "lottie-react";
import octopusIcon from "../../../public/lottie/octopus.json";
import FormattedPrice from "./FormattedPrice";
import MonthlyChart from "./MonthlyChart";

import { LiaBalanceScaleSolid } from "react-icons/lia";
import { TbMoneybag, TbPigMoney } from "react-icons/tb";

import { useEffect, useRef } from "react";
import logo from "../../../public/octoprice-light.svg";

import { RxShare2 } from "react-icons/rx";
import { PiDownloadSimple } from "react-icons/pi";
import { BsLightningChargeFill } from "react-icons/bs";
import { AiFillFire } from "react-icons/ai";

import Canvas from "./Canvas";

const SavingsChart = ({
  tariff,
  type,
  gsp,
  fromDate,
  compareTo,
  deviceNumber,
  serialNo,
}: {
  tariff: string;
  type: "E" | "G";
  gsp: string;
  fromDate: string;
  compareTo: TariffCategory;
  deviceNumber: string;
  serialNo: string;
}) => {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const toDate = today.toISOString();
  const category = "Tracker";

  const { cost, totalUnit, totalPrice, totalStandingCharge } =
    useConsumptionCalculation({
      tariff,
      fromDate,
      toDate,
      type,
      category,
      deviceNumber,
      serialNo,
      results: "monthly",
    });

  const {
    cost: costSVT,
    totalPrice: totalPriceSVT,
    totalStandingCharge: totalStandingChargeSVT,
  } = useConsumptionCalculation({
    tariff: SVT_ETARIFF,
    fromDate,
    toDate,
    type,
    category: "SVT",
    deviceNumber,
    serialNo,
    results: "monthly",
  });

  if (
    cost === null ||
    costSVT === null ||
    typeof cost === "number" ||
    typeof costSVT === "number"
  ) {
    return "Not available";
  }

  const valueAccessor = (d: { [x: string]: number }) => Object.values(d)[0];
  const periodAccessor = (d: { [x: string]: number }) => Object.keys(d)[0];

  const totalSVT = (totalPriceSVT + totalStandingChargeSVT) / 100;
  const totalCost = (totalPrice + totalStandingCharge) / 100;

  const totalSaving = totalSVT - totalCost;

  const unitRateAverage = totalPrice / totalUnit;
  const unitRateAverageSVT = totalPriceSVT / totalUnit;

  const canShare = "canShare" in navigator && navigator.canShare();

  const handleShare = async () => {
    if (!imageRef.current || !canShare) return;
    const newFile = await toBlob(imageRef.current);
    let data = {};
    if (newFile)
      data = {
        files: [
          new File([newFile], "octoprice.png", {
            type: newFile.type,
          }),
        ],
        title: `Octopus ${ENERGY_TYPE[type]} Bill Savings`,
        text: `Octopus saves me £${evenRound(
          totalSaving,
          0
        )} from ${periodAccessor(cost[cost.length - 1])} - ${periodAccessor(
          cost[0]
        )}`,
      };
    try {
      if (!navigator.canShare(data)) {
        throw new Error("Sorry, cannot share at the moment.");
      }
      await navigator.share(data);
    } catch (err) {
      throw new Error("Sorry, cannot share at the moment.");
    }
  };

  const handleDownload = async () => {
    if (!imageRef.current) return;

    /*const blob = await toBlob(imageRef.current, {});
    const blob = canvasRef.current?.toBlob(function (blob) {
      link.href = URL.createObjectURL(blob);
    }, "image/png");
    try {
      if (blob) {
        if (window !== undefined && "saveAs" in window && window.saveAs) {
          window.saveAs(blob, `octoprice-${ENERGY_TYPE[type]}-saving.png`);
        } else {
          saveAs(blob, `octoprice-${ENERGY_TYPE[type]}-saving.png`);
        }
      } else {
        throw new Error("Sorry, cannot be downloaded at the moment.");
      }
    } catch (err) {
      throw new Error("Sorry, cannot be downloaded at the moment.");
    }*/
    const canvas = await html2canvas(imageRef.current);
    const image = canvas.toBlob((blob) => {
      try {
        if (blob) {
          if (window !== undefined && "saveAs" in window && window.saveAs) {
            window.saveAs(blob, `octoprice-${ENERGY_TYPE[type]}-saving.png`);
          } else {
            saveAs(blob, `octoprice-${ENERGY_TYPE[type]}-saving.png`);
          }
        } else {
          throw new Error("Sorry, cannot be downloaded at the moment.");
        }
      } catch (err) {
        throw new Error("Sorry, cannot be downloaded at the moment.");
      }
    });
  };

  /* const draw = (context: CanvasRenderingContext2D) => {
    const img = new Image();
    img.src = "http://localhost:3000/images/octoprice-bg.jpg";

    img.onload = () => {
      context.drawImage(img, 0, 0);
      context.beginPath();
      context.moveTo(30, 96);
      context.lineTo(70, 66);
      context.lineTo(103, 76);
      context.lineTo(170, 15);
      context.stroke();
    };
    context.fillStyle = "rgb(200, 0, 0)";
    context.fillRect(10, 10, 50, 50);

    context.fillStyle = "rgba(0, 0, 200, 0.5)";
    context.fillRect(30, 30, 50, 50);
  }; */

  return (
    <>
      <div
        className="relative flex-1 flex flex-col gap-8 rounded-xl p-4 bg-theme-950 border border-accentPink-800/60 shadow-inner bg-gradient-to-br from-transparent via-theme-800/20 to-purple-600/30 bg-cover"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(0,3,35,0.7) 30% , rgba(0,3,35,0.9) 70%, rgba(0,4,51,1) 100% )`,
        }}
      >
        {cost.length > 0 && costSVT.length ? (
          <>
            <div className="flex flex-1 flex-col md:flex-row justify-between gap-4 max-h-full overflow-hidden">
              <MonthlyChart cost={cost} costSVT={costSVT} />
              <div className="flex flex-col justify-between divide-y [&>div]:border-accentBlue-900 gap-1">
                <div className="flex flex-wrap justify-between items-start md:block text-[#85cbf9] bg-theme-900/30">
                  <Badge
                    label="Total Saving"
                    icon={<TbPigMoney className="stroke-[#85cbf9]" />}
                    variant="secondary"
                  />
                  <div className="font-digit text-4xl flex flex-col items-end justify-start">
                    <FormattedPrice price={totalSaving} value="pound" />
                    <div className="text-xs">
                      <Comparison
                        change={evenRound(
                          ((totalCost - totalSVT) / totalSVT) * 100,
                          2
                        )}
                        compare="Variable Tariff"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-start md:block text-[#aaffdd]">
                  <Badge
                    label="Average Unit Rate"
                    icon={<LiaBalanceScaleSolid className="fill-[#aaffdd]" />}
                    variant="secondary"
                  />
                  <div className="font-digit text-4xl flex flex-col items-end justify-start">
                    <FormattedPrice price={unitRateAverage} value="pence" />
                    <div className="text-xs">
                      <Comparison
                        change={evenRound(
                          ((unitRateAverage - unitRateAverageSVT) /
                            unitRateAverageSVT) *
                            100,
                          2
                        )}
                        compare="Variable Tariff"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between items-start md:block text-white">
                  <Badge
                    label="Total Charge"
                    icon={<TbMoneybag className="stroke-white" />}
                    variant="secondary"
                  />
                  <div className="font-digit text-4xl flex flex-col items-end justify-start">
                    <FormattedPrice price={totalCost} value="pound" />
                    <div className="text-xs -translate-y-1">{`@ ${periodAccessor(
                      cost[cost.length - 1]
                    )} - ${periodAccessor(cost[0])}`}</div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between items-start md:block text-accentPink-500">
                  <Badge
                    label="Total SVT Charge"
                    icon={<TbMoneybag className="stroke-accentPink-500" />}
                    variant="secondary"
                  />
                  <div className="font-digit text-4xl flex flex-col items-end justify-start">
                    <FormattedPrice price={totalSVT} value="pound" />
                    <div className="text-xs -translate-y-1">{`@ ${periodAccessor(
                      cost[cost.length - 1]
                    )} - ${periodAccessor(cost[0])}`}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <div
                ref={imageRef}
                className={`w-[300px] h-[300px] lg:w-[600px] lg:h-[600px] bg-theme-950 rounded-2xl`}
              >
                <div
                  className={`${
                    type === "E"
                      ? "bg-[url(/images/octoprice-bg.jpg)]"
                      : "bg-[url(/images/octoprice-bg-gas.jpg)]"
                  } relative font-display rounded-2xl border border-accentPink-500 p-2 px-4 aspect-square w-[300px] h-[300px] bg-cover lg:scale-[2] lg:mb-[300px] origin-top-left`}
                >
                  <span className="absolute left-2 top-2">
                    {type === "E" && (
                      <BsLightningChargeFill className="fill-accentBlue-500/50 w-8 h-8" />
                    )}
                    {type === "G" && (
                      <AiFillFire className="fill-accentPink-500/50 w-8 h-8" />
                    )}
                  </span>
                  <Image
                    src={logo}
                    alt="Octoprice logo"
                    className="absolute top-2 right-2 w-20 h-auto "
                  />
                  <span className="block pt-16 text-accentPink-500 text-2xl m-0 p-0 absolute">
                    Octopus
                  </span>
                  <span className="block text-white text-5xl m-0 p-0 absolute top-[85px]">
                    saves
                    <span className="text-2xl text-accentBlue-500"> me</span>
                  </span>
                  <span className="text-3xl font-sans absolute top-[175px]">
                    £
                  </span>
                  <span className="block font-bold text-white text-8xl ml-4 absolute top-[160px] leading-4 ">
                    {evenRound(totalSaving, 0)}
                  </span>
                  <span className="block text-white text-xl m-0 p-0  absolute top-[200px]">
                    in{" "}
                    <span className="text-accentPink-500 text-3xl font-bold">
                      {ENERGY_TYPE[type]}
                    </span>{" "}
                    bill
                  </span>
                  <span className="block text-accentBlue-500 text-base m-0 p-0  absolute top-[235px]">
                    @{" "}
                    {`${periodAccessor(
                      cost[cost.length - 1]
                    )} - ${periodAccessor(cost[0])}`}
                  </span>
                  <span className="absolute font-sans bottom-2 right-2 text-xs">
                    https://octopriceuk.vercel.app
                  </span>
                </div>
              </div>
            </div>
            <button
              className="-translate-y-4 self-center flex justify-center items-center gap-2 border border-accentBlue-500 p-2 px-6 text-accentBlue-500 rounded-xl hover:bg-accentBlue-800 hover:text-white"
              onClick={canShare ? handleShare : handleDownload}
            >
              {canShare ? (
                <>
                  <RxShare2 /> Share
                </>
              ) : (
                <>
                  <PiDownloadSimple /> Download
                </>
              )}
            </button>
          </>
        ) : (
          <div className="flex-1 flex h-full items-center justify-center flex-col gap-2">
            <Lottie
              animationData={octopusIcon}
              aria-hidden={true}
              className="w-16 h-16"
            />
            <span className="text-sm font-light text-center">
              Octo is working hard to calculate your savings. Please re-visit
              this page later.
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default SavingsChart;
