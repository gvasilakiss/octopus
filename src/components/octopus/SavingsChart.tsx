"use client";

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
import logo from "../../../public/octoprice-sm.svg";

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

  const canShare = "share" in navigator;

  const handleShare = async () => {
    if (!imageRef.current || !canShare) return;

    const canvas = await html2canvas(imageRef.current, {
      onclone: (el) => {
        const elementsWithShiftedDownwardText: NodeListOf<HTMLElement> =
          el.querySelectorAll(".shifted-text");
        elementsWithShiftedDownwardText.forEach((element) => {
          element.style.transform = "translateY(-25%)";
        });
      },
    });
    canvas.toBlob(async (blob) => {
      let data = {};
      if (blob) {
        data = {
          files: [
            new File([blob], "octoprice.png", {
              type: blob.type,
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
          await navigator.share(data);
        } catch (err) {
          if (err instanceof Error) {
            if (!err.message.includes("cancellation of share"))
              console.log(err.message);
          }
        }
      }
    });
  };

  const handleDownload = async () => {
    if (!imageRef.current) return;

    const canvas = await html2canvas(imageRef.current, {
      onclone: (el) => {
        const elementsWithShiftedDownwardText: NodeListOf<HTMLElement> =
          el.querySelectorAll(".shifted-text");
        elementsWithShiftedDownwardText.forEach((element) => {
          element.style.transform = "translateY(-25%)";
        });
      },
    });
    canvas.toBlob((blob) => {
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
                    variant="item"
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
                    variant="item"
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
                    variant="item"
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
                    variant="item"
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
                className={`w-[300px] h-[300px] lg:w-[600px] lg:h-[600px] bg-accentPink-500`}
              >
                <div
                  className={`${
                    type === "E"
                      ? "bg-[url(/images/octoprice-bg.jpg)]"
                      : "bg-[url(/images/octoprice-bg-gas.jpg)]"
                  } relative font-display font-medium rounded-3xl border-[5px] border-accentPink-500 p-2 px-4 aspect-square w-[300px] h-[300px] bg-cover lg:scale-[2] lg:mb-[300px] origin-top-left`}
                >
                  <span className="absolute left-2 top-2">
                    {type === "E" && (
                      <BsLightningChargeFill className="fill-accentBlue-500/50 w-8 h-8" />
                    )}
                    {type === "G" && (
                      <AiFillFire className="fill-accentPink-500/50 w-8 h-8" />
                    )}
                  </span>
                  <svg
                    className="absolute top-2 right-2 w-[83px] h-[20px]"
                    width="83"
                    height="20"
                    viewBox="0 0 250 58"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M235.301 47.04C231.973 47.04 229.157 46.4213 226.853 45.184C224.592 43.904 222.864 41.9627 221.669 39.36C220.517 36.7573 219.941 33.4507 219.941 29.44C219.941 25.3867 220.517 22.08 221.669 19.52C222.864 16.9173 224.613 14.9973 226.917 13.76C229.221 12.48 232.101 11.84 235.557 11.84C238.714 11.84 241.36 12.4587 243.493 13.696C245.626 14.8907 247.226 16.704 248.293 19.136C249.402 21.5253 249.957 24.5333 249.957 28.16V30.848H225.765C225.85 33.536 226.234 35.7547 226.917 37.504C227.642 39.2107 228.709 40.4693 230.117 41.28C231.525 42.048 233.296 42.432 235.429 42.432C236.88 42.432 238.138 42.2613 239.205 41.92C240.314 41.536 241.232 41.0027 241.957 40.32C242.725 39.6373 243.301 38.8267 243.685 37.888C244.069 36.9493 244.282 35.9253 244.325 34.816H249.829C249.786 36.608 249.445 38.272 248.805 39.808C248.165 41.3013 247.226 42.5813 245.989 43.648C244.752 44.7147 243.237 45.5467 241.445 46.144C239.653 46.7413 237.605 47.04 235.301 47.04ZM225.893 26.624H244.133C244.133 24.7467 243.92 23.168 243.493 21.888C243.066 20.608 242.448 19.5627 241.637 18.752C240.869 17.9413 239.952 17.3653 238.885 17.024C237.861 16.64 236.688 16.448 235.365 16.448C233.402 16.448 231.738 16.8107 230.373 17.536C229.008 18.2613 227.962 19.3707 227.237 20.864C226.512 22.3573 226.064 24.2773 225.893 26.624Z"
                      fill="white"
                    />
                    <path
                      d="M203.394 47.04C200.151 47.04 197.42 46.4213 195.201 45.184C193.026 43.904 191.361 41.9627 190.209 39.36C189.1 36.7147 188.546 33.408 188.546 29.44C188.546 25.472 189.1 22.1867 190.209 19.584C191.361 16.9813 193.047 15.04 195.265 13.76C197.527 12.48 200.3 11.84 203.585 11.84C205.889 11.84 207.873 12.1387 209.537 12.736C211.244 13.3333 212.652 14.208 213.761 15.36C214.871 16.512 215.681 17.8987 216.193 19.52C216.748 21.1413 217.025 22.9973 217.025 25.088H211.329C211.329 23.1253 211.052 21.5253 210.497 20.288C209.985 19.008 209.153 18.0693 208.001 17.472C206.849 16.832 205.335 16.512 203.457 16.512C201.58 16.512 199.959 16.9387 198.593 17.792C197.228 18.6027 196.183 19.904 195.457 21.696C194.732 23.488 194.369 25.856 194.369 28.8V30.144C194.369 32.9173 194.711 35.2213 195.394 37.056C196.119 38.8907 197.164 40.2347 198.529 41.088C199.895 41.9413 201.559 42.368 203.521 42.368C205.441 42.368 206.978 42.0267 208.13 41.344C209.324 40.6613 210.177 39.68 210.689 38.4C211.244 37.12 211.521 35.584 211.521 33.792H217.025C217.025 35.6693 216.748 37.4187 216.193 39.04C215.681 40.6613 214.871 42.0693 213.761 43.264C212.652 44.4587 211.244 45.3973 209.537 46.08C207.831 46.72 205.783 47.04 203.394 47.04Z"
                      fill="white"
                    />
                    <path
                      d="M178.139 6.272V0H183.771V6.272H178.139ZM178.139 46.272V12.608H183.771V46.272H178.139Z"
                      fill="white"
                    />
                    <path
                      d="M158.809 46.272V12.608H163.353L163.865 18.176H164.312C164.654 17.1093 165.123 16.1067 165.721 15.168C166.318 14.1867 167.129 13.3973 168.153 12.8C169.177 12.16 170.435 11.84 171.929 11.84C172.569 11.84 173.145 11.904 173.657 12.032C174.211 12.1173 174.617 12.224 174.873 12.352V17.536H172.761C171.31 17.536 170.051 17.792 168.985 18.304C167.961 18.7733 167.107 19.456 166.425 20.352C165.742 21.248 165.23 22.3147 164.889 23.552C164.59 24.7893 164.441 26.112 164.441 27.52V46.272H158.809Z"
                      fill="white"
                    />
                    <path
                      d="M124.416 57.344V12.608H128.896L129.472 17.408H129.92C131.072 15.5307 132.544 14.144 134.336 13.248C136.128 12.3093 138.155 11.84 140.416 11.84C143.232 11.84 145.621 12.4587 147.584 13.696C149.547 14.9333 151.061 16.8747 152.128 19.52C153.195 22.1227 153.728 25.5147 153.728 29.696C153.728 33.6213 153.173 36.8853 152.064 39.488C150.997 42.048 149.483 43.9467 147.52 45.184C145.557 46.4213 143.275 47.04 140.672 47.04C139.221 47.04 137.856 46.8693 136.576 46.528C135.296 46.1867 134.144 45.6533 133.12 44.928C132.096 44.16 131.2 43.2 130.432 42.048H130.048V57.344H124.416ZM138.88 42.112C140.971 42.112 142.677 41.7067 144 40.896C145.323 40.0427 146.304 38.7413 146.944 36.992C147.584 35.2 147.904 32.9173 147.904 30.144V28.8C147.904 25.856 147.563 23.5093 146.88 21.76C146.197 19.968 145.195 18.688 143.872 17.92C142.592 17.152 140.992 16.768 139.072 16.768C136.981 16.768 135.253 17.2373 133.888 18.176C132.565 19.072 131.584 20.4373 130.944 22.272C130.347 24.1067 130.048 26.3467 130.048 28.992V29.952C130.048 32.2987 130.261 34.2613 130.688 35.84C131.157 37.376 131.797 38.6133 132.608 39.552C133.461 40.4907 134.421 41.152 135.488 41.536C136.555 41.92 137.685 42.112 138.88 42.112Z"
                      fill="white"
                    />
                    <path
                      d="M80.1355 46.312C78.3862 46.312 77.0208 45.992 76.0395 45.352C75.0582 44.6693 74.3542 43.7947 73.9275 42.728C73.5008 41.6187 73.2875 40.4454 73.2875 39.208V16.616H68.9355V11.88H73.4155L74.4395 2.47202H78.9195V11.88H85.2555V16.616H78.9195V38.376C78.9195 39.4427 79.1115 40.2534 79.4955 40.808C79.8795 41.32 80.6048 41.576 81.6715 41.576H85.2555V45.288C84.8288 45.5014 84.3168 45.672 83.7195 45.8C83.1222 45.928 82.5035 46.0347 81.8635 46.12C81.2662 46.248 80.6902 46.312 80.1355 46.312Z"
                      fill="#EE00AB"
                    />
                    <path
                      d="M54.796 47.312C51.5533 47.312 48.8227 46.6933 46.604 45.456C44.428 44.176 42.764 42.2347 41.612 39.632C40.5027 36.9867 39.948 33.68 39.948 29.712C39.948 25.744 40.5027 22.4587 41.612 19.856C42.764 17.2533 44.4493 15.312 46.668 14.032C48.9293 12.752 51.7027 12.112 54.988 12.112C57.292 12.112 59.276 12.4107 60.94 13.008C62.6467 13.6053 64.0547 14.48 65.164 15.632C66.2733 16.784 67.084 18.1707 67.596 19.792C68.1507 21.4133 68.428 23.2693 68.428 25.36H62.732C62.732 23.3973 62.4547 21.7973 61.9 20.56C61.388 19.28 60.556 18.3413 59.404 17.744C58.252 17.104 56.7373 16.784 54.86 16.784C52.9827 16.784 51.3613 17.2107 49.996 18.064C48.6307 18.8747 47.5853 20.176 46.86 21.968C46.1347 23.76 45.772 26.128 45.772 29.072V30.416C45.772 33.1893 46.1133 35.4933 46.796 37.328C47.5213 39.1627 48.5667 40.5067 49.932 41.36C51.2973 42.2133 52.9613 42.64 54.924 42.64C56.844 42.64 58.38 42.2987 59.532 41.616C60.7267 40.9333 61.58 39.952 62.092 38.672C62.6467 37.392 62.924 35.856 62.924 34.064H68.428C68.428 35.9413 68.1507 37.6907 67.596 39.312C67.084 40.9333 66.2733 42.3413 65.164 43.536C64.0547 44.7307 62.6467 45.6693 60.94 46.352C59.2333 46.992 57.1853 47.312 54.796 47.312Z"
                      fill="#EE00AB"
                    />
                    <circle
                      cx="18.5"
                      cy="28.044"
                      r="15.5"
                      fill="white"
                      stroke="#EE00AB"
                      strokeWidth="6"
                    />
                    <circle
                      cx="102.5"
                      cy="28.044"
                      r="15.5"
                      fill="white"
                      stroke="#EE00AB"
                      strokeWidth="6"
                    />
                    <circle cx="101" cy="28.544" r="10" fill="#0B004D" />
                    <circle cx="95.6667" cy="23.2107" r="2" fill="white" />
                    <circle cx="20" cy="28.544" r="10" fill="#0B004D" />
                    <circle cx="15.6667" cy="23.2107" r="2" fill="white" />
                  </svg>
                  <span className="block pt-16 text-accentPink-500 text-2xl m-0 p-0 absolute -top-[10px]">
                    Have
                  </span>
                  <span className="shifted-text block text-white text-5xl m-0 p-0 absolute top-[65px]">
                    saved
                  </span>
                  <span className="text-3xl font-sans absolute top-[105px]">
                    £
                  </span>
                  <span className="shifted-text block font-bold text-white text-8xl ml-6 absolute top-[95px] leading-none">
                    {evenRound(totalSaving, 0)}
                  </span>
                  <span className="block text-white text-xl m-0 p-0 absolute top-[180px]">
                    in{" "}
                    <span className="text-accentPink-500 text-3xl font-bold">
                      {ENERGY_TYPE[type]}
                    </span>{" "}
                    bill
                  </span>
                  <span className="block text-accentBlue-500 text-base m-0 p-0  absolute top-[210px]">
                    since {`${periodAccessor(cost[cost.length - 1])}`}
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
