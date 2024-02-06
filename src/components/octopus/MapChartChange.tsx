import { useEffect, useRef } from "react";

import Loading from "../Loading";

import { IUkMapData, useUkGspMapData } from "@/hooks/useUkGspMap";

import {
  ENERGY_TYPE,
  ENERGY_TYPE_ICON,
  QuerySingleTariffPlanResult,
  Single_tariff,
  Single_tariff_gsp_record,
  Single_tariff_gsp_record_charge_type,
  TRACKER,
  gsp,
} from "@/data/source";
import useTariffQuery from "@/hooks/useTariffQuery";
import { addSign, calculateChangePercentage, evenRound } from "@/utils/helpers";
import {
  axisRight,
  extent,
  geoIdentity,
  geoPath,
  interpolate,
  pointer,
  scaleLinear,
  scalePoint,
  scaleSequential,
  select,
  selectAll,
  zoom,
  zoomIdentity,
  zoomTransform,
} from "d3";

import { EnergyIcon } from "./EnergyIcon";
import ErrorMessage from "./ErrorMessage";
import usePriceCapQuery from "@/hooks/usePriceCapQuery";

interface IMapChart {
  tariff: string;
  compareTo: string; // must be the same tariff type
  type: keyof typeof ENERGY_TYPE;
  rate?: Single_tariff_gsp_record_charge_type;
  gsp: string;
}

const MapChart = ({
  tariff,
  compareTo,
  type,
  rate = "standard_unit_rate_inc_vat",
  gsp,
}: IMapChart) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mapData = useUkGspMapData();

  let width = 320;
  let height = 480;

  if (typeof document !== "undefined") {
    const currentChartWidth = document
      .querySelector(".mapDiv")
      ?.getBoundingClientRect().width;
    width = currentChartWidth === undefined ? width : currentChartWidth;
  }

  const { isLoading, isError, isSuccess, refetch, data, error } =
    useTariffQuery<QuerySingleTariffPlanResult>({
      tariff,
      type,
    });

  const {
    isLoading: isLoadingCompare,
    isError: isErrorCompare,
    isSuccess: isSuccessCompare,
    refetch: refetchCompare,
    data: dataCompare,
    error: errorCompare,
  } = useTariffQuery<QuerySingleTariffPlanResult>({
    tariff: compareTo,
    type,
  });

  let path = geoPath();
  if (mapData?.districts) {
    const projection = geoIdentity()
      .reflectY(true)
      .fitSize([width, height], mapData?.districts ?? null);
    path = geoPath(projection);
  }

  useEffect(() => {
    if (
      !svgRef.current ||
      !mapData ||
      !mapData?.districts ||
      !data ||
      !dataCompare ||
      isLoading ||
      isLoadingCompare
    )
      return;

    let scale = 1;
    const svg = select(svgRef.current);
    const tooltip = svg.select(".tooltipContainer");
    const defs = svg.append("defs");

    if (rate === "standard_unit_rate_inc_vat") {
      const validDate = new Date(
        data[0].tariffs_active_at as string
      ).toLocaleDateString();
      const updateDate =
        validDate === new Date().toLocaleDateString()
          ? `Today (${validDate})`
          : validDate ===
            new Date(
              new Date().setDate(new Date().getDate() - 1)
            ).toLocaleDateString()
          ? `Yesterday (${validDate})`
          : `Updated at ${validDate}`;
      svg.select(".info").text(updateDate);
    }

    const tariffTypeKey =
      `single_register_${ENERGY_TYPE[type]}_tariffs` as keyof QuerySingleTariffPlanResult;
    const singleTariffByGsp = (data[0]?.[tariffTypeKey] ?? []) as Single_tariff;
    const singleTariffToCompareByGsp = (dataCompare[0]?.[tariffTypeKey] ??
      []) as Single_tariff;

    const allValues = Object.values(
      singleTariffByGsp
    ) as Single_tariff_gsp_record[];
    const allToCompareValues = Object.values(
      singleTariffToCompareByGsp
    ) as Single_tariff_gsp_record[];

    const allValuesDifferences = allValues.map((value, i) => {
      if ("direct_debit_monthly" in value)
        return evenRound(
          value["direct_debit_monthly"][rate] -
            allToCompareValues[i]["direct_debit_monthly"][rate]
        );
      if ("varying" in value)
        return value["varying"][rate] - allToCompareValues[i]["varying"][rate];
    });

    let valueExtent = extent(allValuesDifferences, (d) => d);

    if (!valueExtent[0] && !valueExtent[1]) {
      valueExtent = [0, TRACKER[0].cap.E];
    }
    const colorScale = scaleSequential(
      interpolate("#FFFFFF", "#ce2cb9")
    ).domain(valueExtent);

    const valueExtentasPoint = valueExtent.map((value) =>
      evenRound(value, 2, true)
    );
    const legendScale = scalePoint()
      .domain(valueExtentasPoint)
      .range([height / 2, 0]);
    const legendAxis = axisRight(legendScale)
      .tickSize(10)
      .ticks(2)
      .tickFormat((d, i) => `${d}p`);

    const legendGradient = defs
      .append("linearGradient")
      .attr("id", "legendGradient");
    legendGradient
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    legendGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#ce2cb9");
    legendGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#FFFFFF");
    svg
      .select<SVGGElement>(".legend")
      .append("rect")
      .attr("width", 10)
      .attr("height", height / 2)
      .style("fill", "url(#legendGradient)");
    const legendAxisRender = svg
      .select<SVGGElement>(".legend")
      .attr("transform", `translate(10,${height / 2 - 20})`)
      .call(legendAxis);
    legendAxisRender
      .style("color", "#00000080")
      .selectAll("text")
      .attr("font-size", 10)
      .attr("fill", "#FFFFFF80");

    const getPrice = (tariffDetails: Single_tariff_gsp_record) => {
      if (tariffDetails) {
        let key = "";
        if ("direct_debit_monthly" in tariffDetails)
          key = "direct_debit_monthly";
        if ("varying" in tariffDetails) key = "varying";
        if (key === "") return;

        return tariffDetails[key as keyof Single_tariff_gsp_record][rate] ===
          null
          ? "--"
          : evenRound(
              tariffDetails[key as keyof Single_tariff_gsp_record][rate],
              2
            ) + "p";
      }
      return;
    };

    svg
      .select(".districtGroup")
      .selectAll("path")
      .data(mapData.districts.features)
      .join("path")
      .attr("d", (d) => path(d.geometry) ?? null)
      .attr("fill", (d) =>
        d.properties?.Name === `_${gsp}` ? "#13357e" : "#03155e"
      )
      .attr("data-zone", (d) => d.properties?.Name)
      .attr("data-zoneName", (d) => d.properties?.LongName)
      .on("pointerenter pointermove", function (e) {
        select(this).attr("fill", "#092287");

        const coordinates = pointer(e);
        const gsp = select(this).attr("data-zone") as gsp;

        // Tooltip position
        const tooltipPosition = svgRef.current
          ?.querySelector(".tooltip")
          ?.getBoundingClientRect();
        const tooltipShiftLeft =
          (svgRef.current?.getBoundingClientRect()?.right ?? Infinity) <
          e.clientX + (tooltipPosition?.width ?? 200)
            ? -(tooltipPosition?.width ?? 0) - 20
            : 0;
        const tooltipShiftUp =
          (svgRef.current?.getBoundingClientRect()?.bottom ?? Infinity) <
          e.clientY + (tooltipPosition?.height ?? 200)
            ? -(tooltipPosition?.height ?? 0) - 20
            : 0;
        tooltip
          .attr("opacity", "1")
          .transition()
          .duration(20)
          .attr("transform", `translate(${coordinates[0]},${coordinates[1]})`);
        tooltip
          .select(".tooltipTranslate")
          .attr(
            "transform",
            `translate(${tooltipShiftLeft},${tooltipShiftUp})`
          );
        tooltip
          .select(".zone")
          .text(select(this).attr("data-zone").replace("_", ""));
        tooltip.select(".zoneName").text(select(this).attr("data-zoneName"));
        tooltip
          .select(".zonePrice")
          .text(
            `🆕 ${ENERGY_TYPE_ICON[type]} ${getPrice(singleTariffByGsp[gsp])}`
          );
        tooltip
          .select(".zonePriceOld")
          .text(
            `⏹️ ${ENERGY_TYPE_ICON[type]} ${getPrice(
              singleTariffToCompareByGsp[gsp]
            )}`
          );
        tooltip
          .select(".zoneCompareT1")
          .text(
            `🆚 ${
              getPrice(singleTariffByGsp[gsp]) === "--"
                ? "--"
                : addSign(
                    Number(
                      calculateChangePercentage(
                        parseFloat(getPrice(singleTariffByGsp[gsp]) ?? "--"),
                        parseFloat(
                          getPrice(singleTariffToCompareByGsp[gsp]) ?? "--"
                        )
                      )
                    )
                  )
            }%`
          );
      })
      .on("pointerleave", function (d) {
        select(this).attr(
          "fill",
          select(this).attr("data-zone") === `_${gsp}` ? "#13357e" : "#03155e"
        );
      })
      .on("pointerleave.zoom", null);

    svg.on("mouseleave", function () {
      tooltip.attr("opacity", "0");
    });

    function updatePrice(mapData: IUkMapData) {
      svg
        .select(".figures")
        .selectAll("text")
        .data(mapData.districts.features)
        .join("text")
        .text((d) => {
          const gsp = d?.properties?.Name as gsp;
          return (
            addSign(
              evenRound(
                parseFloat(getPrice(singleTariffByGsp[gsp]) ?? "--") -
                  parseFloat(getPrice(singleTariffToCompareByGsp[gsp]) ?? "--"),
                2
              )
            ) + "p"
          );
        })
        .attr("transform", (d) => {
          const coords = path.centroid(d.geometry);
          return `translate(${coords[0]} ${coords[1]})`;
        })
        .attr("text-anchor", "middle")
        .attr("fill", (_, i) => {
          const value = allValuesDifferences[i];
          return colorScale(value ?? 0);
        })
        .attr("font-weight", "bold")
        .style("pointer-events", "none");
    }
    updatePrice(mapData);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on("zoom", function (event) {
        scale = event.transform.k;
        selectAll(".zoomGroup").attr("transform", event.transform);
        selectAll(".figures")
          .selectAll("text")
          .attr("font-size", 14 / event.transform.k);
        tooltip.attr("opacity", "0");
        selectAll(".tooltip").attr(
          "transform",
          `translate(${10 / scale} ${10 / scale}) scale(${1 / scale})`
        );

        // synchronize zoom level of all maps
        const thisMap = this;
        if (event.sourceEvent?.target) {
          selectAll<SVGSVGElement, unknown>(".mapChartSvg")
            .filter(function () {
              return this !== thisMap;
            })
            .call(zoomBehavior.transform, event.transform);
        }
      });

    svg.call(zoomBehavior);

    // set zoom to original state at beginning and re-render
    svg
      .transition()
      .duration(500)
      .call(
        zoomBehavior.transform,
        zoomIdentity,
        zoomTransform(svg.node()!).invert([width / 2, height / 2])
      );
  }, [
    mapData,
    data,
    type,
    path,
    height,
    gsp,
    rate,
    width,
    isLoading,
    dataCompare,
    isLoadingCompare,
  ]);

  return (
    <div className="mapDiv relative h-[450px] flex-1 flex items-center justify-center flex-col rounded-xl bg-black/30 border border-accentPink-700/50 shadow-inner overflow-hidden">
      {isLoading && <Loading />}
      {isError && <ErrorMessage error={error} errorHandler={() => refetch()} />}
      {isSuccess && mapData && (
        <>
          <EnergyIcon type={type} />
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            ref={svgRef}
            className="mapChartSvg"
          >
            <g>
              <g className="zoomGroup">
                <g className="districtGroup"></g>
                <path
                  fill="none"
                  stroke="#010422"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  d={path(mapData.interiors) ?? undefined}
                />
                <g className="figures"></g>
                <g
                  className="tooltipContainer"
                  opacity="0"
                  pointerEvents="none"
                >
                  <g className="tooltip" transform="translate(10 10)">
                    <g className="tooltipTranslate">
                      <rect width="150" height="116" fill="#000000CC" />
                      <text
                        className="zone text-2xl font-bold fill-accentPink-500"
                        x="10"
                        y="30"
                      ></text>
                      <text
                        className="zoneName text-xs fill-white/60"
                        x="10"
                        y="44"
                      ></text>
                      <text
                        className="zonePrice fill-white"
                        x="10"
                        y="70"
                      ></text>
                      <text
                        className="zonePriceOld fill-white"
                        x="10"
                        y="90"
                      ></text>
                      <text className="zoneCompare fill-white" x="10" y="110">
                        <tspan className="zoneCompareT1"></tspan>
                        <tspan dy="14" className="zoneCompareT2" fontSize="8">
                          *vs SVT cap
                        </tspan>
                      </text>
                    </g>
                  </g>
                </g>
              </g>
              <g className="legend"></g>
              <text
                className="info font-display font-bold fill-white/60 text-lg"
                x="10"
                y="30"
              />
            </g>
          </svg>
          <p className="absolute text-xs text-accentBlue-800 right-1 bottom-1">
            [map source:{" "}
            <a href="https://opennetzero.org/dataset/gis-boundaries-for-gb-dno-license-areas">
              National Grid ESO
            </a>
            ]
          </p>
        </>
      )}
    </div>
  );
};

export default MapChart;
