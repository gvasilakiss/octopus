import { UserContext } from "@/context/user";
import { IConsumptionData, IUserApiResult, TariffType } from "@/data/source";
import useAccountDetails from "@/hooks/useAccountDetails";
import { useQuery } from "@tanstack/react-query";
import { useContext, useEffect, useRef } from "react";
import NotCurrentlySupported from "./NotCurrentlySupported";
import {
  arc,
  scaleBand,
  scaleLinear,
  select,
  csv,
  Selection,
  scaleTime,
  scaleUtc,
  scaleRadial,
  areaRadial,
  curveLinearClosed,
  min,
  max,
  extent,
  interpolate,
  quantize,
  interpolateSpectral,
  ScaleRadial,
  ScaleLinear,
  ScaleBand,
  interpolateRdYlBu,
  sum,
  lineRadial,
  curveCatmullRomOpen,
  curveNatural,
} from "d3";

import {
  FaCloud,
  FaCloudRain,
  FaCloudShowersHeavy,
  FaRegSnowflake,
  FaSun,
  FaCloudSun,
} from "react-icons/fa";
import { FaCloudBolt } from "react-icons/fa6";
import { GiFog } from "react-icons/gi";
import { MdWindPower } from "react-icons/md";
import { selectOrAppend, toNextTen } from "@/utils/helpers";
import useConsumptionData from "@/hooks/useConsumptionData";

interface IWeatherData {
  time: string;
  weather_code: string;
  sunshine_duration: string;
  temperature_2m_max: string;
  temperature_2m_min: string;
  sunrise: string;
  sunset: string;
  precipitation_hours: string;
}

const DataArtContainer = () => {
  const chartRef = useRef<null | SVGSVGElement>(null);

  const oneYearEarlier = new Date(
    new Date(new Date().setHours(0, 0, 0, 0)).setFullYear(
      new Date().getFullYear() - 1
    )
  ).toISOString();

  const fromDate = "2023-01-01";
  const toDate = "2023-12-31";
  const fromISODate = new Date(fromDate).toISOString();
  const toISODate = new Date(toDate).toISOString();

  /* gather all data*/
  const {
    postcode,
    setValue,
    value,
    data,
    isSuccess,
    isLoading,
    error,
    isError,
    currentEContract,
    currentETariff,
    MPAN,
    ESerialNo,
    currentGContract,
    currentGTariff,
    MPRN,
    GSerialNo,
  } = useAccountDetails();

  const {
    data: consumptionEData,
    isSuccess: consumptionEIsSuccess,
    isLoading: consumptionEIsLoading,
  } = useConsumptionData({
    fromISODate,
    toISODate,
    type: "E",
    category: "Chart",
    deviceNumber: MPAN,
    serialNo: ESerialNo,
    apiKey: value.apiKey,
  });

  const {
    data: consumptionGData,
    isSuccess: consumptionGIsSuccess,
    isLoading: consumptionGIsLoading,
  } = useConsumptionData({
    fromISODate,
    toISODate,
    type: "G",
    category: "Chart",
    deviceNumber: MPRN,
    serialNo: GSerialNo,
    apiKey: value.apiKey,
  });
  // get coordinates and then weather info
  // https://api.postcodes.io/postcodes/RG194SD
  // https://archive-api.open-meteo.com/v1/archive?latitude=51.394907&longitude=-1.25207&start_date=2023-01-01&end_date=2023-12-18&daily=weather_code,apparent_temperature_max,apparent_temperature_min,sunshine_duration&wind_speed_unit=mph&timezone=auto

  /*
  0 - cloud covering half or less of the sky throughout the period            
1 - cloud covering more than half the sky during part of the period & half or 
    less for the rest                                               
2 - cloud covering more than half the sky throughout the period             
3 - sandstorm, duststorm or blowing snow                                    
4 - fog or ice fog or thick haze                                            
5 - drizzle                                                                 
6 - rain1                                                                   
7 - snow, or rain and snow mixed                                            
8 - shower(s)                                                               
9 - thunderstorm(s) with or without precipitation   
*/

  const colorScheme = {
    octopus: "#bfded8",
    weatherSymbol: "#888",
    xAxis: "#aaa",
    textMonth: "#000",
    textYear: "#798f8b66",
    textTitle: "#000",
    tempRing: "#ccc",
    consumptionRing: '#ccc',
    Gradients: () => (
      <defs>
        <radialGradient id="fillMorning">
          <stop offset="75%" stopColor="#02011C" />
          <stop offset="90%" stopColor="#1A2C64" />
          <stop offset="95%" stopColor="#297EA5" />
          <stop offset="98%" stopColor="#6AD9E0" />
          <stop offset="100%" stopColor="#D8FEF7" />
        </radialGradient>
        <radialGradient id="fillNight">
          <stop offset="70%" stopColor="#FFC5CB" />
          <stop offset="85%" stopColor="#0BA5CB" />
          <stop offset="90%" stopColor="#09457A" />
          <stop offset="95%" stopColor="#0A1A50" />
          <stop offset="100%" stopColor="#050228" />
        </radialGradient>
        <radialGradient id="gas" cx="0.75" cy="0.65" r="0.92" fx="40%" fy="40%">
          <stop offset="30%" stopColor="#663e86" />
          <stop offset="35%" stopColor="#6f3e88" />
          <stop offset="45%" stopColor="#863f8d" />
          <stop offset="50%" stopColor="#a63d90" />
          <stop offset="55%" stopColor="#c83b8d" />
          <stop offset="60%" stopColor="#e53a86" />
          <stop offset="65%" stopColor="#f83c7f" />
          <stop offset="70%" stopColor="#ff4958" />
        </radialGradient>
        <radialGradient
          id="electricity"
          cx="0.45"
          cy="0.75"
          r="0.99"
          fx="80%"
          fy="100%"
        >
          <stop offset="45%" stopColor="#8eff76" />
          <stop offset="50%" stopColor="#00f4b4" />
          <stop offset="55%" stopColor="#00e0ed" />
          <stop offset="60%" stopColor="#00b1ff" />
          <stop offset="65%" stopColor="#0093ff" />
          <stop offset="70%" stopColor="#2f86ff" />
          <stop offset="80%" stopColor="#deff4d" />
          <stop offset="95%" stopColor="#fcff41" />
        </radialGradient>
      </defs>
    ),
  };

  const width = 900;
  const height = 900;
  const innerRadius = (0.35 * width) / 2;
  const outerRadius = (0.85 * width) / 2;

  const xScale = scaleUtc(
    [new Date(fromDate), new Date(toDate)],
    [0, 2 * Math.PI]
  );

  /* draw the template with weather info */
  useEffect(() => {
    if (!chartRef.current) return;

    const weatherIcon = [
      "M 162.747 86.523 l -43.335 -43.0943 l -33.9458 33.9458 l 43.0943 43.0943 l 34.1865 -33.9458 z M 96.3 222.7875 H 24.075 v 48.15 h 72.225 v -48.15 z m 216.675 -239.5463 h -48.15 V 54.2625 h 48.15 V -16.7587 z m 179.3587 94.1333 l -33.9458 -33.9458 l -43.0943 43.0943 l 33.9458 33.9458 l 43.0943 -43.0943 z m -77.2808 329.8275 l 43.0943 43.335 l 33.9458 -33.9458 l -43.335 -43.0943 l -33.705 33.705 z M 481.5 222.7875 v 48.15 h 72.225 v -48.15 h -72.225 z m -192.6 -120.375 c -79.6883 0 -144.45 64.7617 -144.45 144.45 s 64.7617 144.45 144.45 144.45 s 144.45 -64.7617 144.45 -144.45 s -64.7617 -144.45 -144.45 -144.45 z m -24.075 408.0713 h 48.15 V 439.4625 h -48.15 v 71.0212 z m -179.3587 -94.1333 l 33.9458 33.9458 l 43.0943 -43.335 l -33.9458 -33.9458 l -43.0943 43.335 z",
      "M 162.747 86.523 l -43.335 -43.0943 l -33.9458 33.9458 l 43.0943 43.0943 l 34.1865 -33.9458 z M 96.3 222.7875 H 24.075 v 48.15 h 72.225 v -48.15 z m 216.675 -239.5463 h -48.15 V 54.2625 h 48.15 V -16.7587 z m 179.3587 94.1333 l -33.9458 -33.9458 l -43.0943 43.0943 l 33.9458 33.9458 l 43.0943 -43.0943 z m -77.2808 329.8275 l 43.0943 43.335 l 33.9458 -33.9458 l -43.335 -43.0943 l -33.705 33.705 z M 481.5 222.7875 v 48.15 h 72.225 v -48.15 h -72.225 z m -192.6 -120.375 c -79.6883 0 -144.45 64.7617 -144.45 144.45 s 64.7617 144.45 144.45 144.45 s 144.45 -64.7617 144.45 -144.45 s -64.7617 -144.45 -144.45 -144.45 z m -24.075 408.0713 h 48.15 V 439.4625 h -48.15 v 71.0212 z m -179.3587 -94.1333 l 33.9458 33.9458 l 43.0943 -43.335 l -33.9458 -33.9458 l -43.0943 43.335 z",
      "M 201.84 76.8 h -0.36 c -10.44 0 -18.96 8.52 -18.96 18.96 v 36.36 c 0 10.44 8.52 18.96 18.96 18.96 h 0.36 c 10.44 0 18.96 -8.52 18.96 -18.96 V 95.76 c 0 -10.44 -8.52 -18.96 -18.96 -18.96 z M 94.8 259.44 v -0.36 c 0 -10.44 -8.52 -18.96 -18.96 -18.96 H 38.16 c -10.44 0 -18.96 8.52 -18.96 18.96 v 0.36 c 0 10.44 8.52 18.96 18.96 18.96 h 37.56 c 10.56 0 19.08 -8.52 19.08 -18.96 z M 95.64 178.8 c 3.6 3.6 8.4 5.64 13.44 5.64 c 5.04 0 9.84 -2.04 13.44 -5.64 c 7.32 -7.44 7.32 -19.44 0 -26.76 l -24.36 -24.6 c -3.6 -3.6 -8.4 -5.64 -13.44 -5.64 c -5.04 0 -9.84 2.04 -13.44 5.64 c -7.32 7.44 -7.32 19.44 0 26.76 L 95.64 178.8 z M 325.2 126.24 c -3.6 -3.6 -8.4 -5.64 -13.44 -5.64 c -5.04 0 -9.84 2.04 -13.44 5.64 l -24.36 24.48 c -7.32 7.44 -7.32 19.44 0 26.76 l 0.36 0.36 h 0.12 c 3.48 3.36 8.16 5.16 12.96 5.16 c 5.04 0 9.84 -2.04 13.44 -5.64 l 24.36 -24.48 c 7.32 -7.2 7.32 -19.2 0 -26.64 z M 111.48 327.96 c -5.04 0 -9.84 2.04 -13.44 5.64 l -24.36 24.6 c -7.32 7.44 -7.32 19.44 0 26.76 c 3.6 3.6 8.4 5.64 13.44 5.64 c 5.04 0 9.84 -2.04 13.44 -5.64 l 24.36 -24.6 c 7.32 -7.44 7.32 -19.44 0 -26.76 c -3.6 -3.6 -8.4 -5.64 -13.44 -5.64 z M 483.96 311.04 h -2.88 c -3.72 0 -7.32 0 -10.8 0.48 c -13.56 -60.36 -67.32 -105.84 -131.64 -105.84 c -17.52 0 -34.32 3.36 -49.68 9.48 c -6.12 2.4 -12 5.28 -17.64 8.52 c -38.4 22.2 -64.92 62.88 -67.44 109.92 c -0.12 2.52 -0.24 4.92 -0.24 7.44 c 0 4.08 0.24 8.16 0.6 12.12 c 0 0.48 0.12 0.96 0.12 1.32 c -45.48 4.08 -81.12 44.52 -81.12 91.2 c 0 49.32 39.96 92.04 89.16 92.04 h 271.68 c 61.44 0 111.24 -52.08 111.24 -113.76 c -0.12 -61.68 -49.92 -112.92 -111.36 -112.92 z",
      "M 88 60 h 132 v 40 H 88 z M 22 140 h 110 v 40 H 22 z M 66 380 h 110 v 40 H 66 z M 302.06 212.2 c 16.5 4.6 28.6 15.6 34.54 29.2 l 93.94 -142.2 a 50.16 45.6 0 0 0 -77.22 -56.8 l -75.46 64.2 c -8.8 7.4 -13.86 18 -13.86 29 v 78.6 c 7.92 -3 21.56 -6.6 38.06 -2 z M 233.42 245.4 c 3.52 -10.4 10.56 -19.2 19.58 -25.4 H 72.16 a 50.138 45.58 0 0 0 -13.86 89.4 l 99.22 25.8 c 11.66 3 24.2 1.6 34.76 -4.2 l 59.18 -32.2 a 54.714 49.74 0 0 1 -18.04 -53.4 z M 488.62 372.2 l -50.16 -82 a 45.1 41 0 0 0 -27.72 -19.4 l -69.96 -16 c 0.66 6.4 0 13.2 -2.2 19.8 A 54.516 49.56 0 0 1 286 310 c -13.42 0 -21.78 -4.4 -22 -4.4 V 420 c -24.2 0 -44 18 -44 40 h 132 c 0 -22 -19.8 -40 -44 -40 v -85.6 l 101.42 92.2 c 19.58 17.8 51.26 17.8 70.84 0 c 15.84 -14.4 19.36 -36.6 8.36 -54.4 z M 276.32 288.6 c 17.38 4.8 35.86 -4 41.14 -20 c 5.28 -15.8 -4.4 -32.6 -22 -37.4 c -17.38 -4.8 -35.86 4 -41.14 20 c -5.28 15.8 4.62 32.6 22 37.4 z",
      "M175.8 27.6c-54.4 0-160.07 32-160.07 32s24.03 7.26 54.98 14.86C52.11 76.55 22.26 91.2 22.26 91.2s34.61 17 52.52 17c17.98 0 52.72-17 52.72-17s-8.3-4.05-18.8-8.19c24.2 4.88 48.6 8.59 67.1 8.59 43.6 0 119.2-20.32 147.9-28.48 13.8 4.98 34.8 11.68 48 11.68 21.2 0 62-17 62-17s-40.8-17-62-17c-15.2 0-40.5 8.8-53.5 13.72C285.8 45.5 216.5 27.6 175.8 27.6z m145.1 57.1c-34.2 0-100.4 17-100.4 17s66.2 17 100.4 17c34.1 0 100.4-17 100.4-17s-66.3-17-100.4-17z m-167.7 57.1c-34.2 0-100.46 17-100.46 17s66.26 17 100.46 17c19.4 0 49.3-5.5 71.5-10.3-15.4 7.4-26.5 13.6-26.5 13.6s9.1 5.1 22.2 11.5c-35.1 3.9-80.9 15.7-80.9 15.7s66.2 17 100.4 17c15.1 0 36.6-3.4 55.9-7.1.9.1 1.9.1 2.8.1 23.9 0 63.4-18.2 85.1-29.1 4.2.3 8.1.5 11.7.5 34.1 0 100.4-17 100.4-17s-66.3-17-100.4-17c-11 0-25.4 1.8-39.7 4.2-19.6-8.4-41.6-16.1-57.1-16.1-14.7 0-35.4 6.9-54.1 14.8-19.1-4.6-64.8-14.8-91.3-14.8z m195.5 81.8c-46.2 0-136.1 32-136.1 32s31.7 11.3 67.2 20.5c-4-.2-7.8-.3-11.4-.3-60.1 0-176.95 25.3-176.95 25.3s116.85 25.4 176.95 25.4c21.1 0 49.2-3.1 76.8-7.2-27.5 9.1-53.1 21.1-53.1 21.1s66.2 31 100.4 31c34.1 0 100.4-31 100.4-31s-56.1-26.3-91.7-30.5c25.8-4.8 44.2-8.8 44.2-8.8s-36.1-7.8-78.5-14.8c48.2-5.9 118-30.7 118-30.7s-89.9-32-136.2-32z m-253.37 3.2c-21.1 0-61.88 25.7-61.88 25.7s40.78 25.6 61.88 25.6c21.17 0 62.07-25.6 62.07-25.6s-40.9-25.7-62.07-25.7z m81.77 119.6c-21.1 0-61.9 25.7-61.9 25.7s15 9.4 31.4 16.8c-4.8-.5-9.3-.7-13.3-.7-34.2 0-100.43 17-100.43 17s37.91 9.7 71.23 14.5c-17.97 4.4-39.56 15-39.56 15s34.61 17 52.56 17c18 0 52.7-17 52.7-17s-15.5-7.6-31.2-12.6c35.2-1.5 95.1-16.9 95.1-16.9s-19.9-5.1-43.6-9.7c21.6-6.2 49-23.4 49-23.4s-40.9-25.7-62-25.7z m238.3 75.4c-21.1 0-61.9 17-61.9 17s16.6 6.9 34 11.9c-35.6 2.2-92 16.7-92 16.7s66.2 17 100.4 17c34.1 0 100.4-17 100.4-17s-33.7-8.6-65.4-13.6c21.1-4.5 46.5-15 46.5-15s-40.9-17-62-17z",
      "M416 128c-.6 0-1.1.2-1.6.2 1.1-5.2 1.6-10.6 1.6-16.2 0-44.2-35.8-80-80-80-24.6 0-46.3 11.3-61 28.8C256.4 24.8 219.3 0 176 0 114.1 0 64 50.1 64 112c0 7.3.8 14.3 2.1 21.2C27.8 145.8 0 181.5 0 224c0 53 43 96 96 96h320c53 0 96-43 96-96s-43-96-96-96z M88 374.2c-12.8 44.4-40 56.4-40 87.7 0 27.7 21.5 50.1 48 50.1s48-22.4 48-50.1c0-31.4-27.2-43.1-40-87.7-2.2-8.1-13.5-8.5-16 0z m160 0c-12.8 44.4-40 56.4-40 87.7 0 27.7 21.5 50.1 48 50.1s48-22.4 48-50.1c0-31.4-27.2-43.1-40-87.7-2.2-8.1-13.5-8.5-16 0z m160 0c-12.8 44.4-40 56.4-40 87.7 0 27.7 21.5 50.1 48 50.1s48-22.4 48-50.1c0-31.4-27.2-43.1-40-87.7-2.2-8.1-13.5-8.5-16 0z",
      "M183.9 370.1c-7.6-4.4-17.4-1.8-21.8 6l-64 112c-4.4 7.7-1.7 17.5 6 21.8 2.5 1.4 5.2 2.1 7.9 2.1 5.5 0 10.9-2.9 13.9-8.1l64-112c4.4-7.6 1.7-17.4-6-21.8z m96 0c-7.6-4.4-17.4-1.8-21.8 6l-64 112c-4.4 7.7-1.7 17.5 6 21.8 2.5 1.4 5.2 2.1 7.9 2.1 5.5 0 10.9-2.9 13.9-8.1l64-112c4.4-7.6 1.7-17.4-6-21.8z m-192 0c-7.6-4.4-17.4-1.8-21.8 6l-64 112c-4.4 7.7-1.7 17.5 6 21.8 2.5 1.4 5.2 2.1 7.9 2.1 5.5 0 10.9-2.9 13.9-8.1l64-112c4.4-7.6 1.7-17.4-6-21.8z m384 0c-7.6-4.4-17.4-1.8-21.8 6l-64 112c-4.4 7.7-1.7 17.5 6 21.8 2.5 1.4 5.2 2.1 7.9 2.1 5.5 0 10.9-2.9 13.9-8.1l64-112c4.4-7.6 1.7-17.4-6-21.8z m-96 0c-7.6-4.4-17.4-1.8-21.8 6l-64 112c-4.4 7.7-1.7 17.5 6 21.8 2.5 1.4 5.2 2.1 7.9 2.1 5.5 0 10.9-2.9 13.9-8.1l64-112c4.4-7.6 1.7-17.4-6-21.8z M416 128c-.6 0-1.1.2-1.6.2 1.1-5.2 1.6-10.6 1.6-16.2 0-44.2-35.8-80-80-80-24.6 0-46.3 11.3-61 28.8C256.4 24.8 219.3 0 176 0 114.2 0 64 50.1 64 112c0 7.3.8 14.3 2.1 21.2C27.8 145.8 0 181.5 0 224c0 53 43 96 96 96h320c53 0 96-43 96-96s-43-96-96-96z",
      "M510.9 152.3l-5.9-14.5c-3.3-8-12.6-11.9-20.8-8.7L456 140.6v-29c0-8.6-7.2-15.6-16-15.6h-16c-8.8 0-16 7-16 15.6v46.9c0 .5.3 1 .3 1.5l-56.4 23c-5.9-10-13.3-18.9-22-26.6 13.6-16.6 22-37.4 22-60.5 0-53-43-96-96-96s-96 43-96 96c0 23.1 8.5 43.9 22 60.5-8.7 7.7-16 16.6-22 26.6l-56.4-23c.1-.5.3-1 .3-1.5v-46.9C104 103 96.8 96 88 96H72c-8.8 0-16 7-16 15.6v29l-28.1-11.5c-8.2-3.2-17.5.7-20.8 8.7l-5.9 14.5c-3.3 8 .7 17.1 8.9 20.3l135.2 55.2c-.4 4-1.2 8-1.2 12.2 0 10.1 1.7 19.6 4.2 28.9C120.9 296.4 104 334.2 104 376c0 54 28.4 100.9 70.8 127.8 9.3 5.9 20.3 8.2 31.3 8.2h99.2c13.3 0 26.3-4.1 37.2-11.7 46.5-32.3 74.4-89.4 62.9-152.6-5.5-30.2-20.5-57.6-41.6-79 2.5-9.2 4.2-18.7 4.2-28.7 0-4.2-.8-8.1-1.2-12.2L502 172.6c8.1-3.1 12.1-12.2 8.9-20.3z M224 96c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z m32 272c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z m0-64c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z m0-64c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z m0-88s-16-23.2-16-32 7.2-16 16-16 16 7.2 16 16-16 32-16 32z m32-56c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z",
      "M139 400s-23 25.3-23 40.7c0 12.8 10.3 23.3 23 23.3s23-10.5 23-23.3c0-15.4-23-40.7-23-40.7z M217 368s-23 25.3-23 40.7c0 12.8 10.4 23.3 23 23.3 12.7 0 23-10.5 23-23.3 0-15.4-23-40.7-23-40.7z M295 400s-23 25.3-23 40.7c0 12.8 10.3 23.3 23 23.3 12.6 0 23-10.5 23-23.3 0-15.4-23-40.7-23-40.7z M373 368s-23 25.3-23 40.7c0 12.8 10.4 23.3 23 23.3 12.7 0 23-10.5 23-23.3 0-15.4-23-40.7-23-40.7z M393.2 161.2C380.5 96.6 323.9 48 256 48c-39.7 0-76 14-100.9 45.4 34.3 2.6 66.1 15.2 90.7 39.8 18.2 18.2 31 40.5 37.4 64.8h-33.5c-15.3-43.7-56-75-105.7-75-6 0-14.3.7-20.6 2C70 136 32 180.4 32 235.5 32 297.6 79.4 352 141.2 352h242.7c51.5 0 96.2-46 96.2-97.8-.1-49.4-38.4-89.6-86.9-93z",
      "M 678.4 287.44 H 502.16 L 660.64 87.2 c 3.28 -4.24 0.32 -10.4 -5.04 -10.4 H 348.8 c -2.24 0 -4.4 1.2 -5.52 3.2 L 136 438 c -2.48 4.24 0.56 9.6 5.52 9.6 h 139.52 l -71.52 286.08 c -1.52 6.24 6 10.64 10.64 6.16 L 682.8 298.4 c 4.16 -3.92 1.36 -10.96 -4.4 -10.96 z",
    ];

    const monthData = [
      { month: "January", days: 31 },
      { month: "February", days: 28 },
      { month: "March", days: 31 },
      { month: "April", days: 30 },
      { month: "May", days: 31 },
      { month: "June", days: 30 },
      { month: "July", days: 31 },
      { month: "August", days: 31 },
      { month: "September", days: 30 },
      { month: "October", days: 31 },
      { month: "November", days: 30 },
      { month: "December", days: 31 },
    ];

    const yDayScale = scaleLinear()
      .domain([0, 24])
      .range([innerRadius, outerRadius]);

    const addWeatherSymbols = (
      g: Selection<SVGGElement, unknown, null, undefined>,
      data: IWeatherData[]
    ) =>
      g.attr("transform", "rotate(-90)").call((g) =>
        g
          .selectAll("g")
          .data(data)
          .join("g")
          .attr(
            "transform",
            (d, i, arr) => `
          rotate(${(i * 360) / 365})
          translate(${outerRadius + 7},0)
        `
          )
          .call((g) =>
            g
              .append("path")
              .attr(
                "d",
                (d) =>
                  weatherIcon[
                    Number(d.weather_code) > 10
                      ? Math.floor(Number(d.weather_code) / 10)
                      : Number(d.precipitation_hours) <
                        Number(d.sunshine_duration) / 60 / 60 / 2
                      ? 0
                      : Number(d.weather_code)
                  ]
              )
              .style("fill", colorScheme.weatherSymbol)
              .attr("transform", "rotate(90), scale(0.013)")
          )
      );

    const drawNightRegion = (
      g: Selection<SVGGElement, unknown, null, undefined>,
      data: IWeatherData[]
    ) => {
      g.selectAll("*").remove();
      g.append("path")
        .attr("fill", "url(#fillMorning")
        .attr("fill-opacity", 0.8)
        .attr(
          "d",
          areaRadial<IWeatherData>()
            .curve(curveLinearClosed)
            .angle((d) => xScale(new Date(d.time)))
            .outerRadius((d) => {
              const sunrise = new Date(d.sunrise);
              return yDayScale(sunrise.getHours() + sunrise.getMinutes() / 60);
            })
            .innerRadius(innerRadius)(data)
        );
      g.append("path")
        .attr("fill", "url(#fillNight")
        .attr("fill-opacity", 0.8)
        .attr(
          "d",
          areaRadial<IWeatherData>()
            .curve(curveLinearClosed)
            .angle((d) => xScale(new Date(d.time)))
            .innerRadius((d) => {
              const sunset = new Date(d.sunset);
              return yDayScale(sunset.getHours() + sunset.getMinutes() / 60);
            })
            .outerRadius(outerRadius)(data)
        );
    };

    const drawTemperatureBar = (
      g: Selection<SVGGElement, unknown, null, undefined>,
      data: IWeatherData[],
      xScale: ScaleBand<string>,
      yScale: ScaleRadial<number, number, never>,
      colorScale: ScaleLinear<string, string, never>
    ) => {
      g.selectAll("*").remove();
      const tempArc = arc<IWeatherData>()
        .innerRadius((d) => yScale(Number(d.temperature_2m_min)) ?? 0)
        .outerRadius((d) => yScale(Number(d.temperature_2m_max)) ?? 0)
        .startAngle((d) => xScale(d.time) ?? 0)
        .endAngle((d) => xScale(d.time) ?? 0 + xScale.bandwidth())
        .padAngle(0.025)
        .padRadius(innerRadius);
      g.selectAll("path")
        .data(data)
        .join("path")
        .attr("opacity", 1)
        .style("fill", (d) =>
          colorScale(
            (Number(d.temperature_2m_max) + Number(d.temperature_2m_min)) / 2
          )
        )
        .style("stroke", (d) =>
          colorScale(
            (Number(d.temperature_2m_max) + Number(d.temperature_2m_min)) / 2
          )
        )
        .attr("d", tempArc);

      g.attr("text-anchor", "middle")
        .selectAll()
        .data(yScale.ticks(6).reverse())
        .join("g")
        .call((g) =>
          g
            .append("circle")
            .attr("fill", "none")
            .attr("stroke", colorScheme.tempRing)
            .attr("stroke-opacity", 0.4)
            .attr("r", yScale)
        )
        .call((g) =>
          g
            .append("text")
            .attr("y", (d) => yScale(d))
            .attr("dy", "0.35em")
            .attr("stroke-linecap", "round")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .attr("fill", colorScheme.textMonth)
            .attr("paint-order", "stroke")
            .text((x, i) => `${x.toFixed(0)}°c`)
        );
    };

    const xAxis = (g: Selection<SVGGElement, unknown, null, undefined>) =>
      g
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .call((g) =>
          g
            .selectAll("g")
            .data(monthData)
            .join("g")
            .attr(
              "transform",
              (d, i, arr) => `
          rotate(${
            ([...monthData]
              .slice(0, i)
              .reduce((acc, cur) => acc + cur.days, 0) /
              365) *
            360
          })
          translate(${innerRadius},0)
        `
            )
            .call((g) =>
              g
                .append("line")
                .attr("x1", (d, i) => (i % 3 === 0 ? -40 : -5))
                .attr("x2", (d, i) =>
                  i % 3 === 0
                    ? outerRadius - innerRadius + 100
                    : outerRadius - innerRadius
                )
                .style("stroke", colorScheme.xAxis)
            )
            .call((g) =>
              g
                .append("text")
                .attr("text-anchor", "middle")
                .attr("transform", (d, i, arr) =>
                  ((i * 360) / arr.length) % 360 >= 270 ||
                  ((i * 360) / arr.length) % 360 < 90
                    ? `rotate(${90 + 360 / 12 / 2})translate(${
                        (Math.PI * innerRadius) / 12
                      },16)`
                    : `rotate(${-90 + 360 / 12 / 2})translate(${
                        -(Math.PI * innerRadius) / 12
                      },-9)`
                )
                .style("font-family", "sans-serif")
                .style("font-size", 10)
                .attr("fill", colorScheme.textMonth)
                .text((d) => d.month)
            )
        );

    const svg = select(chartRef.current);
    const container = svg
      .select<SVGGElement>(".container")
      .style("font-size", 10)
      .style("font-family", "sans-serif");
    const nightRegionContainer = container.select<SVGGElement>(".nightRegion");
    const weatherSymbolContainer =
      container.select<SVGGElement>(".weatherSymbol");
    const temperatureContainer = container.select<SVGGElement>(".temperature");
    const xAxisContainer = container.select<SVGGElement>(".xAxis");

    csv("/weather.csv")
      .then((data) => {
        if (data) {
          drawNightRegion(
            nightRegionContainer,
            data as unknown as IWeatherData[]
          );
          addWeatherSymbols(
            weatherSymbolContainer,
            data as unknown as IWeatherData[]
          );

          const tempMeanMin = min(
            data,
            (d) =>
              (Number(d.temperature_2m_max) + Number(d.temperature_2m_min)) / 2
          );
          const tempMeanMax = max(
            data,
            (d) =>
              (Number(d.temperature_2m_max) + Number(d.temperature_2m_min)) / 2
          );
          const tempMin = min(data, (d) => Number(d.temperature_2m_min));
          const tempMax = max(data, (d) => Number(d.temperature_2m_max));

          const interpolated = interpolate(tempMeanMin!, tempMeanMax!);
          const colorDomain = quantize(interpolated, 7);
          const colorScale = scaleLinear(
            colorDomain,
            quantize(interpolateRdYlBu, 7).reverse()
          );
          const xTempScale = scaleBand(
            data.map((d) => d.time),
            [0, (2 * Math.PI * data.length) / 365]
          );
          const yTempScale = scaleLinear()
            .domain([tempMin!, toNextTen(tempMax ?? 0)])
            .range([innerRadius, outerRadius - 10])
            .nice();
          drawTemperatureBar(
            temperatureContainer,
            data as unknown as IWeatherData[],
            xTempScale,
            yTempScale,
            colorScale
          );
        }
      })
      .catch((err) => {
        throw new Error(err);
      });
    xAxisContainer.call(xAxis);
    const octopus = selectOrAppend(
      "path",
      "octopus",
      xAxisContainer
    ) as Selection<SVGPathElement, unknown, null, undefined>;
    octopus
      .attr("transform", "rotate(90), scale(0.7), translate(-125 -143)")
      .attr(
        "d",
        "m56.32,236.42c-1.84.14-3.16.88-4.55,1.38-3.55,1.28-7.18,2.27-10.94,2.67-2.41.26-4.8.76-7.24.76-2.23,0-4.39-.7-6.61-.72-1.81-.02-3.46-.58-5.08-1.25-2.93-1.2-5.49-2.67-6.2-6.23-.33-1.64.36-2.87.8-4.2.83-2.5,2.87-4.13,4.76-5.82,1.84-1.64,3.75-3.22,5.54-4.92,2.3-2.18,4.05-4.88,4.83-7.86.61-2.32,1.55-4.85.41-7.37-.14-.31-.08-.74-.05-1.11.13-2.14-.57-4.11-1.35-6.03-.61-1.49-1.38-2.9-1.74-4.5-.18-.79-.84-1.47-1.29-2.2-2.37-3.8-4.59-7.71-7.17-11.37-2.98-4.22-5.34-8.81-7.95-13.23-1.73-2.93-3.06-6.17-4.53-9.28-1.61-3.42-2.86-6.98-3.93-10.59-1.09-3.7-2.3-7.36-3.04-11.19C-.22,126.99.07,120.59,0,114.2c-.02-1.96,0-3.92,0-5.87-.01-2.95.7-5.83.92-8.75.23-3.08,1.08-6,1.66-8.99.67-3.48,1.68-6.89,2.65-10.31.86-3.05,1.74-6.07,2.91-9,1.01-2.53,2.04-5.05,3.15-7.53,1.83-4.08,3.95-8.01,6.22-11.86,1.43-2.42,3.08-4.7,4.86-6.88.61-.74.87-1.69,1.48-2.4,3.63-4.25,7.22-8.56,11.4-12.27,3.37-3,6.81-5.93,10.53-8.54,4.78-3.36,9.85-6.21,15.06-8.79,4.49-2.23,9.23-3.95,13.96-5.65,5.17-1.86,10.56-2.94,15.91-4.14,3.34-.75,6.71-1.49,10.11-1.85,2.57-.27,5.13-.65,7.71-.86,11.84-.99,23.69-.13,35.53-.43.49-.01,1,.1,1.46.26.69.24,1.34.43,2.09.23.38-.11.9-.14,1.23.04,1.63.9,3.41.39,5.11.65.59.09,1.06.46,1.64.53,2.74.34,5.44.88,8.15,1.3,4.62.72,9.05,2.12,13.59,3.1,2.66.57,5.24,1.72,7.85,2.65,2.38.85,4.63,1.99,7.05,2.76,2.81.9,5.34,2.45,7.93,3.85,4.02,2.18,7.9,4.54,11.66,7.18,3.06,2.14,6.02,4.38,8.87,6.76,3.79,3.15,7.33,6.57,10.36,10.48,1.14,1.47,2.54,2.71,3.57,4.29,2.32,3.58,5.04,6.88,7.22,10.57,2.51,4.27,4.5,8.77,6.54,13.26,1.49,3.28,2.88,6.6,3.69,10.13.73,3.16,1.74,6.25,2.47,9.42.56,2.42.89,4.91,1.63,7.3.18.59.09,1.23.14,1.84.26,3.11,1.15,6.13,1.13,9.27-.05,6.08.04,12.17-.05,18.25-.03,1.7-.48,3.4-.74,5.09-.23,1.5-.4,3.01-.72,4.49-.57,2.64-1.28,5.24-2.13,7.81-.98,2.96-1.85,5.96-3.07,8.84-1.11,2.62-2.31,5.21-3.55,7.78-1.08,2.24-2.09,4.54-3.46,6.6-2.26,3.41-3.89,7.15-6.14,10.57-2.71,4.1-4.99,8.48-7.43,12.76-2.29,4.02-3.99,8.29-5.6,12.63-1.04,2.81-1.22,5.34-.49,8.19.97,3.75,2.84,6.86,5.62,9.49,1.77,1.67,3.42,3.51,5.36,4.95,2.01,1.48,3.45,3.32,4.7,5.39,1.57,2.58.71,6.34-1.69,8.17-3.52,2.7-7.53,3.76-11.87,3.81-1.1.01-2.06.56-3.17.53-2.71-.07-5.36-.61-8.05-.78-3.29-.2-6.39-1.31-9.49-2.25-2.11-.64-4.34-1.17-6.2-2.53-.28-.21-.6-.28-1.08-.11,1.8,2.54,3.5,5.08,5.7,7.28,2.17,2.18,4.67,3.78,7.4,5.1,3.39,1.64,6.71,3.39,9.78,5.58,1.71,1.22,2.54,3.04,3.05,4.96.49,1.85-1.13,2.84-2.14,3.96-1.4,1.55-3.19,2.69-5.1,3.54-3.88,1.73-7.87,3.14-12.05,3.95-4.38.85-8.81.94-13.25.76-3.87-.16-7.63-.89-11.35-2.08-2.73-.88-5.45-1.8-8.08-2.92-1.5-.64-2.88-1.57-4.28-2.43-.97-.6-1.93-1.3-3.02-1.78-2.78-1.21-4.91-3.31-7.26-5.17-1.28-1.01-2.5-2.15-3.85-3.09-.48-.33-.93-.54-1.11.5-.42,2.42-1.24,4.76-2,7.1-.7,2.16-1.25,4.37-2.1,6.47-2.52,6.22-6.29,11.48-12.37,14.69-2.02,1.07-4.18,1.91-6.61,1.75-1.99-.13-4.01-.16-5.99,0-3,.24-5.67-.62-8.11-2.18-2.4-1.53-4.7-3.22-6.39-5.59-2.39-3.35-4.57-6.82-5.87-10.75-.43-1.3-.69-2.65-1.01-3.98-.56-2.37-1.16-4.72-1.54-7.24-1.07.78-2.14,1.42-3.05,2.24-3.21,2.9-6.88,5.06-10.69,7.04-.73.38-1.37.93-2.1,1.32-5.61,2.97-11.6,4.87-17.85,5.78-4.21.61-8.5.46-12.77.17-3.58-.24-7.03-1.11-10.35-2.22-3.05-1.02-6.25-1.95-8.83-4.09-1.44-1.19-2.72-2.55-3.96-3.92-.79-.87-.23-3.52.73-4.72,2.09-2.63,5.13-3.9,7.83-5.67,2.1-1.37,4.44-2.19,6.61-3.4,3.12-1.73,5.31-4.38,7.64-6.92.83-.91,1.51-1.96,2.45-3.2Z"
      )
      .attr("fill", colorScheme.octopus);

    const savingMsg = selectOrAppend(
      "g",
      "saving",
      xAxisContainer
    ) as Selection<SVGGElement, unknown, null, undefined>;
    savingMsg.selectAll("*").remove();
    savingMsg
      .append("text")
      .attr("font-size", "100px")
      .attr("y", 30)
      .attr("fill", colorScheme.textYear)
      .attr("transform", "rotate(90)")
      .text("2023");

    const heading = select(".heading");
    heading.selectAll("*").remove();
    heading
      .append("text")
      .attr("font-size", "65px")
      .attr("letter-spacing", -2)
      .attr("transform", "translate(-430 -460)")
      .attr("fill", colorScheme.textTitle)
      .text("My");
    heading
      .append("text")
      .attr("font-size", "65px")
      .attr("letter-spacing", -2)
      .attr("transform", "translate(-430 -410)")
      .attr("fill", colorScheme.textTitle)
      .text("Energy");
    heading
      .append("text")
      .attr("font-size", "65px")
      .attr("letter-spacing", -2)
      .attr("transform", "translate(-430 -360)")
      .attr("fill", colorScheme.textTitle)
      .text("Footprint");
  }, [
    colorScheme.octopus,
    colorScheme.tempRing,
    colorScheme.textMonth,
    colorScheme.textTitle,
    colorScheme.textYear,
    colorScheme.weatherSymbol,
    colorScheme.xAxis,
    innerRadius,
    outerRadius,
    xScale,
  ]);

  /* draw the consumption info */
  useEffect(() => {
    if (
      !data ||
      !chartRef.current ||
      (!consumptionEIsSuccess && !consumptionGIsSuccess) ||
      (!consumptionEData?.results && !consumptionGData?.results)
    )
      return;

    const icons = {
      gas: "M 16.682 9.384 A 6.9498 6.9498 90 0 0 15.024 7.08 l -0.582 -0.534 a 0.1618 0.1618 90 0 0 -0.26 0.066 l -0.26 0.746 c -0.162 0.468 -0.46 0.946 -0.882 1.416 c -0.028 0.03 -0.06 0.038 -0.082 0.04 c -0.022 0.002 -0.056 -0.002 -0.086 -0.03 c -0.028 -0.024 -0.042 -0.06 -0.04 -0.096 c 0.074 -1.204 -0.286 -2.562 -1.074 -4.04 C 11.106 3.42 10.2 2.462 9.068 1.794 l -0.826 -0.486 c -0.108 -0.064 -0.246 0.02 -0.24 0.146 l 0.044 0.96 c 0.03 0.656 -0.046 1.236 -0.226 1.718 c -0.22 0.59 -0.536 1.138 -0.94 1.63 a 5.9128 5.9128 90 0 1 -0.95 0.922 a 7.052 7.052 90 0 0 -2.006 2.43 A 6.955 6.955 90 0 0 3.2 12.2 c 0 0.944 0.186 1.858 0.554 2.72 a 6.988 6.988 90 0 0 1.51 2.218 c 0.648 0.64 1.4 1.144 2.238 1.494 C 8.37 18.996 9.29 19.18 10.24 19.18 s 1.87 -0.184 2.738 -0.546 A 6.972 6.972 90 0 0 15.216 17.14 c 0.648 -0.64 1.156 -1.388 1.51 -2.218 a 6.884 6.884 90 0 0 0.554 -2.72 c 0 -0.976 -0.2 -1.924 -0.598 -2.818 z",
      electricity:
        "M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z",
    };
    const svg = select(chartRef.current);

    const infoContainer = svg.select(".info");
    infoContainer.selectAll("*").remove();

    const gasConsumption = [];
    const electricityConsumption = [];

    infoContainer
      .append("text")
      .attr("font-size", "40px")
      .attr("letter-spacing", -2)
      .attr("transform", "translate(-380 700)")
      .attr("fill", colorScheme.textTitle)
      .text("Octopus Tracker");
    infoContainer
      .append("text")
      .attr("font-size", "12px")
      .attr("letter-spacing", 0)
      .attr("transform", "translate(-380 715)")
      .attr("fill", colorScheme.textTitle)
      .text("(from 1/7/2023)");
    infoContainer
      .append("path")
      .attr("d", icons.electricity)
      .style("fill", colorScheme.textTitle)
      .attr("transform", "translate(-430 660), scale(3)");
    infoContainer
      .append("text")
      .attr("font-size", "40px")
      .attr("letter-spacing", -2)
      .attr("transform", "translate(-380 630)")
      .attr("fill", colorScheme.textTitle)
      .text("Octopus Tracker");
    infoContainer
      .append("text")
      .attr("font-size", "12px")
      .attr("letter-spacing", 0)
      .attr("transform", "translate(-380 645)")
      .attr("fill", colorScheme.textTitle)
      .text("(from 1/7/2023)");
    infoContainer
      .append("path")
      .attr("d", icons.gas)
      .style("fill", colorScheme.textTitle)
      .attr("transform", "translate(-430 590), scale(2.2)");

    const drawConsumption = (
      g: Selection<SVGGElement, unknown, null, undefined>,
      data: IConsumptionData[],
      scaleY: ScaleLinear<number, number, never>,
      type: Exclude<TariffType, "EG">
    ) => {
      let total = 0;

      g.append("path")
        .classed("draw", true)
        .attr("stroke", `url(#${type === "E" ? "electricity" : "gas"})`)
        .attr("stroke-width", 5)
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("opacity", 0.8)
        .attr("filter", "url(#shadow)")
        .attr(
          "d",
          lineRadial<IConsumptionData>()
            .curve(curveNatural)
            .angle((d) => xScale(new Date(d.interval_start)))
            .radius((d) => {
              total += d.consumption;
              type === "E"
                ? electricityConsumption.push(total)
                : gasConsumption.push(total);
              return scaleY(total);
            })(data)
        );
    };

    const gasChartContainer = svg.select<SVGGElement>(".gasChart");
    gasChartContainer.selectAll("*").remove();
    const electricityChartContainer =
      svg.select<SVGGElement>(".electricityChart");
    electricityChartContainer.selectAll("*").remove();

    if (
      consumptionGIsSuccess &&
      consumptionGData?.results &&
      consumptionEIsSuccess &&
      consumptionEData?.results
    ) {
      const gasResults = [
        ...consumptionGData.results,
      ].reverse() as IConsumptionData[];
      const gasSum = sum(gasResults, (d) => Number(d.consumption));
      const electricityResults = [
        ...consumptionEData.results,
      ].reverse() as IConsumptionData[];
      const electricitySum = sum(electricityResults, (d) =>
        Number(d.consumption)
      );
      const maxSum = max([gasSum, electricitySum]) ?? 0;
      const yConsumptionScale = scaleLinear()
        .domain([0, maxSum+500])
        .range([innerRadius, outerRadius - 20])
        .nice();
      gasChartContainer
        .attr("text-anchor", "middle")
        .selectAll()
        .data(yConsumptionScale.ticks(6).reverse())
        .join("g")
        .call((g) =>
          g
            .append("circle")
            .attr("fill", "none")
            .attr("stroke", colorScheme.consumptionRing)
            .attr("stroke-opacity", 0.4)
            .attr("r", yConsumptionScale)
        )
        .call((g) =>
          g
            .append("text")
            .attr("y", (d) => -yConsumptionScale(d))
            .attr("dy", "0.35em")
            .attr("stroke-linecap", "round")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .attr("fill", colorScheme.textMonth)
            .attr("paint-order", "stroke")
            .text((x, i) => `${x.toFixed(0)}kWh`)
        );

      drawConsumption(gasChartContainer, gasResults, yConsumptionScale, "G");
      drawConsumption(
        electricityChartContainer,
        electricityResults,
        yConsumptionScale,
        "E"
      );
    } else {
      if (consumptionGIsSuccess && consumptionGData?.results) {
      }

      if (consumptionEIsSuccess && consumptionEData?.results) {
      }
    }
  }, [
    consumptionGIsSuccess,
    consumptionEIsSuccess,
    data,
    consumptionEData?.results,
    consumptionGData?.results,
    colorScheme.textTitle,
    xScale,
    innerRadius,
    outerRadius,
  ]);

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
  if (
    isSuccess &&
    typeof currentEContract === "undefined" &&
    typeof currentGContract === "undefined"
  ) {
    return (
      <NotCurrentlySupported>
        Sorry, owing to technical limitations, Octo cannot retrive your data at
        the moment. Please try again later.
      </NotCurrentlySupported>
    );
  }

  return (
    <div className="flex w-full aspect-[210/297] bg-white">
      <svg
        ref={chartRef}
        width={900}
        height={1200}
        viewBox="-450 -500 900 1200"
        className="w-full h-auto"
      >
        <filter id="shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="2" />
        </filter>
        <colorScheme.Gradients />
        <g className="container">
          <g className="nightRegion" />
          <g className="temperature" />
          <g className="xAxis" />
          <g className="weatherSymbol" />
          <g className="gasChart" />
          <g className="electricityChart" />
          <g className="heading" />
          <g className="info" />
        </g>
      </svg>
    </div>
  );
};

export default DataArtContainer;
<stop offset="95%" stopColor="#842f56" />;
