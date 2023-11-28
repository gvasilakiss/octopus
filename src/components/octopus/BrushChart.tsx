"use client";
import { useEffect, useId, useRef } from "react";

import {
  select,
  axisBottom,
  extent,
  max,
  min,
  scaleLinear,
  scaleTime,
  axisLeft,
  line,
  easeLinear,
  brushX,
  D3BrushEvent,
  Selection,
  Line,
  BaseType,
  pointer,
  bisector,
  curveStepAfter,
  curveStepBefore,
  axisRight,
  timeFormat,
  timeMonth,
  utcSecond,
  utcDay,
  utcHour,
  utcMinute,
  utcMonth,
  utcWeek,
  utcYear,
  utcFormat,
  timeFormatDefaultLocale,
  D3ZoomEvent,
  ZoomScale,
  zoom,
  ScaleTime,
  ScaleLinear,
  timeDay,
  timeWeek,
  timeYear,
  tsv,
  area,
} from "d3";
import toast from "react-hot-toast";

import {
  TariffType,
  TariffResult,
  ENERGY_TYPE,
  ENERGY_TYPE_ICON,
  priceCap,
  QueryTariffResult,
  ApiTariffType,
  FETCH_ERROR,
  CapsTSVResult,
} from "@/data/source";

import useTariffQuery from "../../hooks/useTariffQuery";

import {
  assertExtentNotUndefined,
  evenRound,
  fetchApi,
  fetchEachApi,
  selectOrAppend,
  tryFetch,
} from "../../utils/helpers";

import Loading from "@/components/Loading";
import ErrorMessage from "./ErrorMessage";
import { useQuery } from "@tanstack/react-query";

const BrushChart = ({
  tariff,
  type,
  gsp,
}: {
  tariff: string;
  type: TariffType;
  gsp: string;
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const timeIdRef = useRef<number | undefined>(undefined);
  const id = useId();

  const { isLoading, isError, isSuccess, refetch, data, error } =
    useTariffQuery<QueryTariffResult>({
      tariff,
      type,
      gsp,
    });

  const queryCapFn = (url: string) => async () => {
    const capsTsv = await tsv(url, (d) => d as CapsTSVResult);
    return capsTsv;
  };
  const caps = useQuery({
    queryKey: ["getCaps", tariff, type],
    queryFn: queryCapFn(
      "https://gist.githubusercontent.com/edward-designer/232d54ace5006183d873e9eebcf82da2/raw/42772cf5ed5b3e87f1d3d4a4cdc2dd12accd67ed/energy_price_caps.tsv"
    ),
  });

  const isAgile = tariff.includes("AGILE");

  // Specify chart properties (dimensions and colors)
  let widgetWidth = 1000;
  let widgetHeight = 450;
  const fontSize = 14;
  const leadingSize = fontSize * 1.5;
  const innerPadding = 10;
  const padding = { top: 40, bottom: 60, left: 60, right: 20 };
  const axisColor = "#63acb8";

  // Update chart to content width (for responsive layout)
  if (typeof document !== "undefined") {
    widgetWidth =
      document.getElementById(`chart-${id}`)?.getBoundingClientRect().width ??
      widgetWidth;
  }

  useEffect(() => {
    if (!data || !svgRef || !svgRef.current) return;
    // ↓↓↓ when svgRef.current and data are ready //

    select(svgRef.current);

    const lineCharts: Selection<
      BaseType | SVGPathElement,
      TariffResult[],
      BaseType,
      unknown
    >[] = [];

    // Select the SVG element
    const chart = select(svgRef.current) as Selection<
      SVGSVGElement,
      unknown,
      null,
      undefined
    >;
    // Add attr to svg
    chart
      .attr("width", widgetWidth)
      .attr("height", widgetHeight)
      .attr("viewBox", `0, 0, ${widgetWidth}, ${widgetHeight}`);
    chart
      .selectAll("g.chartContainer, g.interactionContainer")
      .attr("transform", `translate(${padding.left}, ${padding.top})`);

    // Add clip path to hide chart outside of the showing area
    chart
      .select(`defs rect`)
      .attr("width", widgetWidth - padding.left - padding.right)
      .attr("height", widgetHeight - padding.top - padding.bottom);

    // Time formatter
    const formatHour = utcFormat("%I %p"),
      formatDay = utcFormat("%a %d"),
      formatWeek = utcFormat("%b %d"),
      formatMonth = utcFormat("%b"),
      formatYear = utcFormat("%Y");

    function multiFormat(date: Date) {
      // note: UK has daylight saving time, so utcYear variant will NOT work as expected
      // use getTimezoneOffset()
      return (
        timeDay(date) < date
          ? formatHour
          : timeMonth(date) < date
          ? timeWeek(date) < date
            ? formatDay
            : formatWeek
          : timeYear(date) < date
          ? formatMonth
          : formatYear
      )(new Date(date.valueOf() - date.getTimezoneOffset() * 60 * 1000));
    }
    // ↓↓↓ DRAW AXES

    // Create the horizontal and vertical scales.
    // different datasets may have different end dates, have to loop over all of them to find the extent
    const xExtent = extent(
      data
        .map((dataset) =>
          extent(dataset.results, (d) => new Date(d.valid_from) ?? new Date())
        )
        .flat(),
      (d) => d
    );
    assertExtentNotUndefined<Date>(xExtent);
    const xScale = scaleTime()
      .domain(xExtent)
      .range([0, widgetWidth - padding.left - padding.right]);

    const maxPrice =
      max(
        data.find((tariff) => tariff.tariffType === "E")?.results ?? [],
        (data) => data?.value_inc_vat ?? 0
      ) ?? 0;
    const minPrice = Math.min(
      0,
      min(
        data.find((tariff) => tariff.tariffType === "E")?.results ?? [],
        (data) => data?.value_inc_vat - 5 ?? 0
      ) ?? 0
    );
    const yScale = scaleLinear(
      [minPrice, maxPrice + 5],
      [widgetHeight - padding.top - padding.bottom, 0]
    ).nice();

    // Function to actually draw axes
    const drawAxes = (
      xScale: ScaleTime<number, number, never>,
      yScale: ScaleLinear<number, number, never>
    ) => {
      const yGrid = axisRight<number>(yScale)
        .tickFormat((d) => "")
        .tickSizeInner(widgetWidth - padding.left - padding.right)
        .tickPadding(0);
      const yAxis = axisLeft<number>(yScale).tickFormat((d) => `${d}p`);
      const xAxis = axisBottom<Date>(xScale)
        .ticks(widgetWidth / 130)
        .tickFormat(multiFormat);
      chart
        .select<SVGSVGElement>("g.grid")
        .attr("color", "#FFFFFF20")
        .transition()
        .call(yGrid);
      const xAxisGroup = chart
        .select<SVGSVGElement>("g.xAxis")
        .attr(
          "transform",
          `translate(0, ${widgetHeight - padding.top - padding.bottom})`
        )
        .attr("color", axisColor);
      chart
        .select(".yAxis")
        .selectAll("line")
        .data([yScale(0)])
        .join("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", (d) => d)
        .attr("y2", (d) => d)
        .attr("stroke-width", "2")
        .attr("stroke", "#63acb8")
        .transition()
        .duration(20)
        .attr("x2", widgetWidth - padding.left - padding.right);

      xAxisGroup.transition().call(xAxis);
      chart
        .select<SVGSVGElement>("g.yAxis")
        .attr("color", axisColor)
        .transition()
        .call(yAxis);
      chart.select(".yAxisText").remove();
      chart
        .select(".yAxis")
        .append("text")
        .classed("yAxisText", true)
        .classed("axisText", true)
        .text("Unit Rate")
        .attr(
          "transform",
          `translate(-${padding.left - leadingSize} ${
            widgetHeight / 2 - padding.top
          }) rotate(-90)`
        )
        .attr("x", 0)
        .attr("y", 0)
        .attr("text-anchor", "start")
        .attr("alignment-basline", "baseline")
        .attr("font-size", "14")
        .attr("fill", axisColor);
    };

    // ↓↓↓ DRAW LINES

    const lineGeneratorFunc = (
      xScale: ScaleTime<number, number, never>,
      yScale: ScaleLinear<number, number, never>
    ) =>
      line<TariffResult>()
        .x((d) => xScale(new Date(d.valid_to)))
        .y((d) => yScale(d.value_inc_vat))
        .curve(curveStepAfter);

    // Function to actually draw lines
    const drawLine = (
      data: [TariffResult[]],
      name: string,
      xScale: ScaleTime<number, number, never>,
      yScale: ScaleLinear<number, number, never>,
      drawAnimate: boolean = false
    ) => {
      const lineGenerator = lineGeneratorFunc(xScale, yScale);
      const lineGraph = selectOrAppend(
        "g",
        name,
        chart.select("g.chartContainer")
      ).attr("clip-path", `url(#clip-${id})`);
      if (typeof lineGraph === "string")
        throw new Error("Selection is not a string");

      const line = lineGraph
        .selectAll("path")
        .data(data)
        .join(
          (enter) =>
            enter
              .append<SVGPathElement>("path")
              .attr("fill", "none")
              .attr("stroke", `url(#${name})`)
              .attr("stroke-width", 1.5),
          (update) => update.transition().duration(500),
          (exit) => exit.remove()
        )
        .attr("d", lineGenerator);

      if (drawAnimate) {
        /* Line animation - simulate draw from left to rigth NOTE: for first time only */
        const length = (line.node() as SVGPathElement).getTotalLength() ?? 0;
        line
          .attr("stroke-dasharray", length + " " + length)
          .attr("stroke-dashoffset", -length)
          .transition()
          .duration(500)
          .ease(easeLinear)
          .attr("stroke-dashoffset", 0);
      }

      return line;
    };
    const drawArea = (
      name: string,
      xScale: ScaleTime<number, number, never>,
      yScale: ScaleLinear<number, number, never>,
      delay: boolean = false
    ) => {
      const areaGraph = selectOrAppend(
        "g",
        `${name}-Area`,
        chart.select("g.chartContainer")
      ).attr("clip-path", `url(#clip-${id})`);
      if (typeof areaGraph === "string")
        throw new Error("Selection is not a string");

      const areaGenerator = area<TariffResult>()
        .x((d) => xScale(new Date(d.valid_from)))
        .y0((d) => yScale(Math.min(0, d.value_inc_vat)))
        .y1(yScale(0))
        .curve(curveStepBefore);
      const payToUseArea = areaGraph
        .selectAll("path")
        .data([data[0].results])
        .join("path")
        .attr("fill", "#aaffdd")
        .attr("stroke", "#aaffdd")
        .transition()
        .delay(delay ? 300 : 0)
        .duration(50)
        .attr("d", areaGenerator);
      areaGraph
        .select<SVGPathElement>(`path`)
        .on("pointermove", (e: PointerEvent) => {
          const coordinates = pointer(e);
          const pointerX = coordinates[0] - padding.left + 70;
          const pointerY = coordinates[1] - padding.top - 20;
          chart
            .select<SVGGElement>(".payToUse")
            .attr("opacity", 1)
            .attr("transform", `translate(${pointerX}, ${pointerY})`);
        })
        .on("pointerleave", (e: PointerEvent) => {
          chart.select<SVGGElement>(".payToUse").attr("opacity", 0);
        });
      chart
        .select<SVGPathElement>(`.yAxis`)
        .on("pointerleave", (e: PointerEvent) => {
          chart.select(".tooltip").attr("opacity", 0);
        });
    };

    // Function to draw price cap levels
    const drawCurrentCap = (
      xScale: ScaleTime<number, number, never>,
      yScale: ScaleLinear<number, number, never>
    ) => {
      const capsData =
        caps.data
          ?.filter((row) => row.Region === `_${gsp}`)
          .sort(
            (a, b) => new Date(a.Date).valueOf() - new Date(b.Date).valueOf()
          ) ?? [];

      const capLineGenerator = (type: keyof CapsTSVResult) =>
        line<CapsTSVResult>()
          .x((d) => xScale(new Date(d.Date).setHours(0, 0, 0, 0)))
          .y((d) => yScale(parseFloat(String(d[type]))))
          .curve(curveStepAfter);
      if (type.includes("E")) {
        chart
          .select(".capE")
          .attr("clip-path", `url(#clip-${id})`)
          .selectAll("path")
          .data([capsData])
          .join("path")
          .transition()
          .duration(500)
          .attr("stroke", "#aa33cc99")
          .attr("stroke-width", 1)
          .attr("fill", "none")
          .attr("stroke-dasharray", "2 2")
          .attr("d", capLineGenerator("E"));
      }
      if (type.includes("G")) {
        chart
          .select(".capG")
          .attr("clip-path", `url(#clip-${id})`)
          .selectAll("path")
          .data([capsData])
          .join("path")
          .transition()
          .duration(500)
          .attr("stroke", "#FF000080")
          .attr("stroke-width", 1)
          .attr("fill", "none")
          .attr("stroke-dasharray", "2 2")
          .attr("d", capLineGenerator("G"));
      }
    };

    // ↓↓↓ TIMELINE
    const drawTimeLine = (xScale: ScaleTime<number, number, never>) => {
      if (isAgile) {
        window.clearInterval(timeIdRef.current);
        const timelineG = selectOrAppend(
          "g",
          "timeline",
          chart.select("g.chartContainer")
        ) as Selection<SVGGElement, unknown, null, undefined>;
        const timelineTriangle = timelineG
          .append("polygon")
          .classed("timelineTriangle", true)
          .attr("points", "0,0 10,0 5,8")
          .attr("fill", "#ce2cb9");
        const timeline = timelineG.append("line");
        timeline
          .attr("x1", padding.left)
          .attr("x2", padding.left)
          .attr("y1", 0)
          .attr("y2", widgetHeight - padding.bottom - padding.top)
          .attr("stroke", "#ce2cb9")
          .attr("stroke-width", 1);
        const setTimelinePosition = () => {
          const xPos = xScale(new Date());
          timeline.transition().duration(50).attr("x1", xPos).attr("x2", xPos);
          timelineTriangle
            .transition()
            .duration(50)
            .attr("transform", `translate(${xPos - 5},0)`);
        };
        setTimelinePosition();
        timeIdRef.current = window.setInterval(setTimelinePosition, 1000);
      }
    };

    const redrawTimeLine = (xScale: ScaleTime<number, number, never>) => {
      if (isAgile) {
        window.clearInterval(timeIdRef.current);
        const timeline = select(".timeline").select("line");
        const timelineTriangle = select(".timelineTriangle");
        const setTimelinePosition = () => {
          const xPos = xScale(new Date());
          timeline.transition().duration(50).attr("x1", xPos).attr("x2", xPos);
          timelineTriangle
            .transition()
            .duration(50)
            .attr("transform", `translate(${xPos - 5},0)`);
        };
        setTimelinePosition();
        timeIdRef.current = window.setInterval(setTimelinePosition, 1000);
      }
    };
    // ↓↓↓ ZOOM

    // Zoom limits
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 32])
      .extent([
        [padding.left, 0],
        [widgetWidth - padding.right, widgetHeight],
      ])
      .translateExtent([
        [padding.left, -Infinity],
        [widgetWidth - padding.right, Infinity],
      ])
      .on("zoom", zoomed);

    function zoomed(event: D3ZoomEvent<SVGSVGElement, ZoomScale>) {
      const zxScale = event.transform.rescaleX(xScale);
      pointerInteraction(zxScale, yScale);
      drawAxes(zxScale, yScale);
      lineCharts.map((chart) => {
        chart
          .attr("stroke-dasharray", "0 0")
          .transition()
          .duration(50)
          .attr("d", lineGeneratorFunc(zxScale, yScale));
      });
      drawCurrentCap(zxScale, yScale);
      drawArea("electricity", zxScale, yScale);
      redrawTimeLine(zxScale);
    }

    /* brush zoom function
    const drawBrush = (
      chart: Selection<SVGSVGElement | null, unknown, null, undefined>,
      targetCharts: Selection<
        BaseType | SVGPathElement,
        TariffResult[],
        SVGPathElement,
        unknown
      >[],
      xExtent: [Date, Date],
    ) => {
      const updateChart = (
        event: D3BrushEvent<TariffResult>,
        targetCharts: Selection<
          BaseType | SVGPathElement,
          TariffResult[],
          SVGPathElement,
          unknown
        >[]
      ) => {
        targetCharts.map((chart) => chart.attr("stroke-dasharray", "0 0"));
        chart.select<SVGGElement>("g.brush").call(brushX().clear);
        const brushExtent = event.selection;
        if (!brushExtent) return;
        if (
          typeof brushExtent?.[0] === "number" &&
          typeof brushExtent?.[1] === "number"
        )
          xScale.domain([
            xScale.invert(brushExtent[0] - padding.left),
            xScale.invert(brushExtent[1] - padding.left),
          ]);
        xAxisGroup.transition().duration(1000).call(xAxis);
        targetCharts.map((chart) =>
          chart.transition().duration(1000).attr("d", lineGenerator)
        );
      };

      const chartBrush = brushX()
        .extent([
          [padding.left, padding.top],
          [widgetWidth - padding.right, widgetHeight - padding.bottom],
        ])
        .on("end", (event) => updateChart(event, targetCharts));
      chart.append("g").attr("class", "brush").call(chartBrush);

      chart.on("dblclick", () => {
        xScale.domain(xExtent);
        xAxisGroup.transition().duration(1000).call(xAxis);
        targetCharts.map((chart) =>
          chart.transition().duration(1000).attr("d", lineGenerator)
        );
      });

      return chartBrush;
    };*/

    // ↓↓↓ TOOLTIP

    // Show points with value on mouse hover
    const pointerInteraction = (
      xScale: ScaleTime<number, number, never>,
      yScale: ScaleLinear<number, number, never>
    ) => {
      const tooltip = chart.select(".tooltip");
      const pointerInteractionArea = chart.select("g.pointerInteraction");
      /* Add clip */
      pointerInteractionArea.attr("clip-path", `url(#clip-${id})`);
      /* Remove all visible elements in case on Zoom */
      tooltip.attr("opacity", "0");

      /* Pointer move */
      chart.on("pointermove", function (e: PointerEvent) {
        const coordinates = pointer(e);
        const pointerX = coordinates[0] - padding.left;
        const xValue = xScale.invert(pointerX);

        const bisectDate = bisector(
          (d: TariffResult) => new Date(d.valid_to)
        ).left;
        // NOTE:bisector requires ASCENDING order!!
        const index =
          data[0].results.length -
          1 -
          bisectDate(
            [...data[0].results].sort(
              (a, b) =>
                new Date(a.valid_to).getTime() - new Date(b.valid_to).getTime()
            ),
            xValue
          );

        const pointValues = isAgile
          ? [
              [
                pointerX,
                data[0].results[index]?.value_inc_vat ?? "--",
                ENERGY_TYPE_ICON[data[0].tariffType],
              ] as const,
            ]
          : data?.map((set) => {
              return [
                pointerX,
                set.results.find(
                  (result) =>
                    new Date(result.valid_from).getTime() ===
                    xValue.setHours(0, 0, 0, 0)
                )?.value_inc_vat ?? "--",
                ENERGY_TYPE_ICON[set.tariffType],
              ] as const;
            });

        // Tooltip position
        const tooltipWidth =
          document
            .getElementById(`chart-${id}`)
            ?.querySelector(`.tooltip`)
            ?.getBoundingClientRect()?.width ?? 0;
        const tooltipLeft =
          widgetWidth - (pointerX + padding.left + 20) < tooltipWidth
            ? pointerX - 10 - tooltipWidth
            : pointerX + 10;
        chart
          .select(".tooltip rect")
          .attr("height", leadingSize * (type.length + 1) + innerPadding * 2);
        chart
          .select(".tooltip")
          .transition()
          .duration(20)
          .attr(
            "opacity",
            `${
              pointValues.every(
                (point) => typeof point[1] !== "number" || point[0] <= 0
              )
                ? "0"
                : "1"
            }`
          )
          .style("transform", `translate(${tooltipLeft}px, ${padding.top}px)`);
        chart
          .select(".date")
          .selectAll("text")
          .data([xValue])
          .join("text")
          .attr("fill", "#FFFFFF80")
          .attr("alignment-baseline", "hanging")
          .text(
            isAgile ? xValue.toLocaleString() : xValue.toLocaleDateString()
          );
        chart
          .select(".price")
          .selectAll("text")
          .data(pointValues)
          .join("text")
          .attr("alignment-baseline", "hanging")
          .attr("fill", "white")
          .attr("transform", (d, i) => `translate (0 ${i * leadingSize})`)
          .text((d) => {
            if (typeof d[1] === "number")
              return `${d[2]} ${evenRound(d[1], 2)}p`;
            if (typeof d[1] === "string") return `${d[2]} ${d[1]}`;
            return "--";
          });

        // Indication line and dots
        pointerInteractionArea
          .selectAll("circle")
          .data(pointValues)
          .join("circle")
          .transition()
          .duration(20)
          .attr("cx", (d) => d[0])
          .attr("cy", (d) => {
            if (typeof d[1] === "number") return yScale(d[1]);
            return 0;
          })
          .attr("fill", "white")
          .attr("r", 4);
        pointerInteractionArea
          .selectAll("line")
          .data([pointerX])
          .join("line")
          .transition()
          .duration(20)
          .attr("x1", (d: number) => d)
          .attr("x2", (d: number) => d)
          .attr("y1", 0)
          .attr("y2", widgetHeight)
          .attr("stroke", "white")
          .attr("strokeWidth", 2)
          .attr("stroke-dasharray", "2 2");
      });
    };

    /* draw charts */
    drawAxes(xScale, yScale);

    if (type.includes("E")) {
      const lineChart = drawLine(
        [data[0].results],
        "electricity",
        xScale,
        yScale,
        true
      );
      lineCharts.push(lineChart);
      drawArea("electricity", xScale, yScale, true);
    }
    if (type.includes("G")) {
      const lineChart2 = drawLine(
        [data[1].results],
        "gas",
        xScale,
        yScale,
        true
      );
      lineCharts.push(lineChart2);
    }
    drawCurrentCap(xScale, yScale);
    pointerInteraction(xScale, yScale);

    /* draw timeline */
    drawTimeLine(xScale);

    /* Legend */
    if (type.includes("E")) {
      chart
        .select(".capEText")
        .text("electricity SVT price cap")
        .attr("transform", "translate(-55 0)")
        .attr("text-anchor", "end")
        .attr("alignment-basline", "baseline")
        .attr("font-size", "10")
        .attr("fill", "#aa33cc")
        .attr("x", widgetWidth - padding.right - padding.left)
        .attr("y", fontSize);
      chart
        .select(".capE")
        .selectAll("line")
        .attr("stroke", "#aa33cc99")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 2")
        .attr("x1", widgetWidth - padding.right - padding.left - 50)
        .attr("y1", fontSize / 2 + 5)
        .attr("x2", widgetWidth - padding.right - padding.left)
        .attr("y2", fontSize / 2 + 5);
    }
    if (type.includes("G")) {
      chart
        .select(".capGText")
        .text("gas SVT price cap")
        .attr("transform", `translate(-55 ${fontSize})`)
        .attr("text-anchor", "end")
        .attr("alignment-basline", "baseline")
        .attr("font-size", "10")
        .attr("fill", "#FF000099")
        .attr("x", widgetWidth - padding.right - padding.left)
        .attr("y", fontSize);
      chart
        .select(".capG")
        .selectAll("line")
        .attr("stroke", "#ff000080")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 2")
        .attr("x1", widgetWidth - padding.right - padding.left - 50)
        .attr("y1", (3 * fontSize) / 2 + 5)
        .attr("x2", widgetWidth - padding.right - padding.left)
        .attr("y2", (3 * fontSize) / 2 + 5);
    }
    chart.call(zoomBehavior);
  }, [
    caps.data,
    data,
    gsp,
    id,
    isAgile,
    leadingSize,
    padding.bottom,
    padding.left,
    padding.right,
    padding.top,
    tariff,
    type,
    widgetHeight,
    widgetWidth,
  ]);

  return (
    <div
      id={`chart-${id}`}
      className="chartDiv relative w-full h-[450px] flex-1 flex items-center justify-center flex-col rounded-xl bg-theme-950 border border-accentPink-700/50 shadow-inner overflow-hidden"
    >
      {isLoading && <Loading />}
      {isError && <ErrorMessage error={error} errorHandler={() => refetch()} />}

      <>
        <svg ref={svgRef}>
          <defs>
            <linearGradient id="electricity" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#aa33cc" />
              <stop offset="50%" stopColor="#3377bb" />
              <stop offset="100%" stopColor="#aaffdd" />
            </linearGradient>
            <linearGradient id="gas" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="red" />
              <stop offset="50%" stopColor="green" />
              <stop offset="100%" stopColor="yellow" />
            </linearGradient>
            <clipPath id={`clip-${id}`}>
              <rect x="0" y="0"></rect>
            </clipPath>
          </defs>
          <g className="chartContainer">
            <g className="grid" />
            <g className="xAxis" />
            <g className="yAxis" />
            <g className="capE">
              <text className="capEText"></text>
              <line></line>
            </g>
            <g className="capG">
              <text className="capGText"></text>
              <line></line>
            </g>
          </g>
          <g className="interactionContainer">
            <g className="pointerInteraction" />
            <g className="payToUse" opacity="0">
              <rect
                width="150"
                height="3em"
                rx={leadingSize / 2}
                fill="#ce2cb9"
                x="0"
                y="0"
              />
              <text fill="#aaffdd" fontSize={10} y="1em" x="0">
                <tspan x="1em" dy=".6em">
                  Yes, you read it right!
                </tspan>
                <tspan x="1em" dy="1.2em">
                  Octopus pays you to use
                </tspan>
                <tspan x="1em" dy="1.2em">
                  electricity for this period!
                </tspan>
              </text>
            </g>
            <g className="tooltip" opacity="0">
              <rect
                width="180"
                rx={leadingSize / 2}
                fill="#00000060"
                x="0"
                y="0"
              />
              <g
                className="date"
                transform={`translate(${innerPadding} ${innerPadding})`}
              />
              <g
                className="price"
                transform={`translate(${innerPadding} ${
                  leadingSize + innerPadding
                })`}
              />
            </g>
          </g>
        </svg>
      </>
    </div>
  );
};

export default BrushChart;
