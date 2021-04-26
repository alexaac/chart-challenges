/* Inspiration from: 
  https://observablehq.com/@d3/bar-chart-race-explained
  https://observablehq.com/@johnburnmurdoch/bar-chart-race-the-most-populous-cities-in-the-world */

import { responsivefy } from "/js/globalHelpers.js";

const n = 12;

// set the dimensions and margins of the diagram
const margin = { top: 20, right: 0, bottom: 10, left: 155 },
  width = 900,
  barSize = 50,
  height = margin.top + barSize * n + margin.bottom;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("class", "chart-group")
  .attr("width", width)
  .attr("height", height)
  .call(responsivefy);

const zoomableGroup = svg
  .append("g")
  .attr("class", "zoomable-group")
  .attr("transform", (d) => `translate(${[100, 100]})`);

const duration = 50;
const k = 10;

// Load data
const promises = [
  d3.csv("data/owid-covid-data.csv"),
  d3.json("data/ne_10m_admin_0_reg.json"),
];

Promise.all(promises)
  .then((data) => {
    let raceData = data[0];
    const mapData = data[1];

    const owidSpecificId = new RegExp("OWID");
    raceData = raceData.filter(
      (d) =>
        d.people_vaccinated_per_hundred !== "" &&
        !owidSpecificId.test(d.iso_code)
    );
    // .slice(0, 100);

    drawChartRace(raceData, mapData);
  })
  .catch((error) => console.log(error));

const drawChartRace = (raceData, mapData) => {
  // Map legend

  const haloHighlight = function (
    text,
    delay,
    strokeWidth = 1,
    opacity = 1,
    color = "#000000"
  ) {
    let textObject = text
      .select(function () {
        return this.parentNode.insertBefore(this.cloneNode(true), this);
      })
      .style("fill", "#ffffff")
      .style("stroke", color)
      .style("stroke-width", 0)
      .style("stroke-linejoin", "round")
      .style("opacity", opacity);

    textObject
      .transition()
      .ease(d3.easeLinear)
      .delay(delay)
      .duration(250)
      .style("stroke-width", strokeWidth)
      .transition()
      .ease(d3.easeLinear)
      .delay(500)
      .duration(250)
      .style("stroke-width", 0);
  };

  const halo = function (text, strokeWidth, color = "#ffffff") {
    text
      .select(function () {
        return this.parentNode.insertBefore(this.cloneNode(true), this);
      })
      .style("fill", color)
      .style("stroke", color)
      .style("stroke-width", strokeWidth)
      .style("stroke-linejoin", "round")
      .style("opacity", 1)
      .style();
  };

  const getWorldSimplified = (mapData) => {
    let mapDataSimplified = topojson.presimplify(mapData);
    let min_weight = topojson.quantile(mapDataSimplified, 0.3);
    mapDataSimplified = topojson.simplify(mapDataSimplified, min_weight);

    let land = mapDataSimplified;

    return land;
  };

  const mapDataSimplified = getWorldSimplified(mapData);

  let regions = mapDataSimplified.objects.ne_10m_admin_0_countries.geometries.map(
    (d) => d.properties.REGION_WB
  );
  regions = [...new Set(regions)];

  // Map

  const land = topojson.feature(mapDataSimplified, {
    type: "GeometryCollection",
    geometries: mapDataSimplified.objects.ne_10m_admin_0_countries.geometries.filter(
      (d) => ["Antarctica", "Greenland"].includes(d.properties.ADMIN)
    ),
  });

  const geoCounties = topojson
    .feature(mapData, mapData.objects.ne_10m_admin_0_countries)
    .features.filter(
      (d) => !["Antarctica", "Greenland"].includes(d.properties.ADMIN)
    );
  const geojsonFeatures = topojson.feature(mapData, {
    type: "GeometryCollection",
    geometries: mapData.objects.ne_10m_admin_0_countries.geometries,
  });

  const colorScale = d3
    .scaleOrdinal(d3.schemeSet3)
    .domain(d3.extent(geoCounties, (d) => d.properties.REGION_WB));

  const mapWidth = 250,
    mapHeight = 130;

  const projection = d3
    .geoNaturalEarth1()
    .fitSize([mapWidth, mapHeight], geojsonFeatures);
  const path = d3.geoPath().projection(projection);

  let mapLegend = zoomableGroup
    .append("g")
    .attr("class", "map-legend")
    .attr(
      "transform",
      `translate(${width - mapWidth}, ${
        margin.top + barSize * (n - 0.45) - mapHeight
      })`
    );

  mapLegend
    .append("rect")
    .attr("x", 0)
    .attr("y", -20)
    .attr("class", "mapback")
    .attr("width", mapWidth)
    .attr("height", mapHeight)
    .style("fill", "#ffffff")
    .style("stroke", "#dddddd");

  let mapSubtitle = mapLegend
    .append("text")
    .attr("x", 5)
    .attr("y", -5)
    .html("World Regions");

  mapSubtitle.call(halo, 5);

  haloHighlight(mapSubtitle, 4500, 1, 1, "#777777");

  const mapFeatures = mapLegend
    .selectAll("path")
    .data(geoCounties)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "land")
    .attr("fill", (d) => colorScale(d.properties.REGION_WB));

  // Race

  const propsData = raceData;

  const latlon = d3.rollup(
    geoCounties,
    ([d]) => ({
      lat: d.properties.lat,
      lon: d.properties.lon,
      REGION_WB: d.properties.REGION_WB,
    }),
    (d) => d.properties.ADM0_A3
  );

  const dataProperties = d3.rollup(
    propsData,
    ([d]) => ({
      value: +d.people_vaccinated_per_hundred,
      continent: d.continent,
      iso_code: d.iso_code,
      lat: latlon.get(d.iso_code) ? latlon.get(d.iso_code).lat : -2000,
      lon: latlon.get(d.iso_code) ? latlon.get(d.iso_code).lon : -2000,
      region: latlon.get(d.iso_code) ? latlon.get(d.iso_code).REGION_WB : "",
    }),
    (d) => d.location
  );

  const names = new Set(raceData.map((d) => d.location));

  const dates = new Set(
    raceData.map((d) => new Date(d.date)).sort((a, b) => d3.ascending(a, b))
  );

  const cumulativeData = d3.rollup(
    raceData,
    ([d]) => ({
      value: +d.people_vaccinated_per_hundred,
      continent: d.continent,
      iso_code: d.iso_code,
      lat: latlon.get(d.iso_code) ? latlon.get(d.iso_code).lat : 0,
      lon: latlon.get(d.iso_code) ? latlon.get(d.iso_code).lon : 0,
      region: latlon.get(d.iso_code) ? latlon.get(d.iso_code).REGION_WB : "",
    }),
    (d) => d.location,
    (d) => new Date(d.date)
  );

  const finalArray = [];

  names.forEach((name) => {
    const datesByName = cumulativeData.get(name);
    let lastValue = Array.from(cumulativeData.get(name))[0][1];

    dates.forEach((date) => {
      const currentValue = datesByName.get(date);

      if (currentValue) {
        lastValue = currentValue;
      }

      let completeNameVal = lastValue;
      completeNameVal.name = name;
      completeNameVal.date = date;
      finalArray.push(completeNameVal);
    });

    cumulativeData.set(name, datesByName);
  });

  raceData = finalArray;

  const datevalues = Array.from(
    d3.rollup(
      raceData,
      ([d]) => +d.value,
      (d) => d.date,
      (d) => d.name
    )
  )
    .map(([date, raceData]) => [date, raceData])
    .sort(([a], [b]) => d3.ascending(a, b));

  function rank(value) {
    const data = Array.from(names, (name) => ({ name, value: value(name) }));
    data.sort((a, b) => d3.descending(a.value, b.value));
    for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
    return data;
  }

  const getKeyframes = () => {
    const keyframes = [];
    let ka, a, kb, b;
    for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
      for (let i = 0; i < k; ++i) {
        const t = i / k;
        keyframes.push([
          new Date(ka * (1 - t) + kb * t),
          rank((name) => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t),
        ]);
      }
    }

    keyframes.push([new Date(kb), rank((name) => b.get(name) || 0)]);
    return keyframes;
  };

  const keyframes = getKeyframes();

  if (!Array.prototype.flatMap) {
    function flatMap(f, ctx) {
      return this.reduce((r, x, i, a) => r.concat(f.call(ctx, x, i, a)), []);
    }
    Array.prototype.flatMap = flatMap;
  }

  const nameframes = d3.groups(
    keyframes.flatMap(([, raceData]) => raceData),
    (d) => d.name
  );
  const prev = new Map(
    nameframes.flatMap(([, raceData]) => d3.pairs(raceData, (a, b) => [b, a]))
  );
  const next = new Map(
    nameframes.flatMap(([, raceData]) => d3.pairs(raceData))
  );

  function bars(svg) {
    let bar = svg.append("g").attr("fill-opacity", 0.6).selectAll("rect");

    return ([date, raceData], transition) =>
      (bar = bar
        .data(raceData.slice(0, n), (d) => d.name)
        .join(
          (enter) =>
            enter
              .append("rect")
              .attr("fill", (d) =>
                colorScale(dataProperties.get(d.name).region)
              )
              .attr("height", y.bandwidth())
              .attr("x", x(0))
              .attr("y", (d) => y((prev.get(d) || d).rank))
              .attr("width", (d) => x((prev.get(d) || d).value) - x(0)),
          (update) => update,
          (exit) =>
            exit
              .transition(transition)
              .remove()
              .attr("y", (d) => y((next.get(d) || d).rank))
              .attr("width", (d) => x((next.get(d) || d).value) - x(0))
        )
        .call((bar) =>
          bar
            .transition(transition)
            .attr("y", (d) => y(d.rank))
            .attr("width", (d) => x(d.value) - x(0))
        ));
  }

  function circles(mapLegend) {
    let circle = mapLegend
      .append("g")
      .attr("class", "map-circles")
      .selectAll("circle");

    return ([date, raceData], transition) => {
      circle = circle
        .data(raceData.slice(0, n), (d) => d.name)
        .join(
          (enter) =>
            enter
              .append("circle")
              .attr("class", "country")
              .attr("fill", "#00ffff")
              .attr("fill-opacity", 0.3)
              .style("stroke", "#00ffff")
              .attr(
                "cx",
                (d) =>
                  projection([
                    dataProperties.get(d.name).lon,
                    dataProperties.get(d.name).lat,
                  ])[0]
              )
              .attr(
                "cy",
                (d) =>
                  projection([
                    dataProperties.get(d.name).lon,
                    dataProperties.get(d.name).lat,
                  ])[1]
              )
              .attr("r", 3),
          (update) => update,
          (exit) =>
            exit
              .transition(transition)
              .remove()
              .attr(
                "cx",
                (d) =>
                  projection([
                    dataProperties.get(d.name).lon,
                    dataProperties.get(d.name).lat,
                  ])[0]
              )
              .attr(
                "cy",
                (d) =>
                  projection([
                    dataProperties.get(d.name).lon,
                    dataProperties.get(d.name).lat,
                  ])[1]
              )
        )
        .call((circle) =>
          circle
            .transition(transition)
            .attr(
              "cx",
              (d) =>
                projection([
                  dataProperties.get(d.name).lon,
                  dataProperties.get(d.name).lat,
                ])[0]
            )
            .attr(
              "cy",
              (d) =>
                projection([
                  dataProperties.get(d.name).lon,
                  dataProperties.get(d.name).lat,
                ])[1]
            )
        );

      circle.append("title").text((d) => d.name);

      return circle;
    };
  }

  function labels(svg) {
    let label = svg
      .append("g")
      .style("font", "bold 12px var(--sans-serif)")
      .style("font-variant-numeric", "tabular-nums")
      .attr("text-anchor", "end")
      .selectAll("text");

    return ([date, raceData], transition) =>
      (label = label
        .data(raceData.slice(0, n), (d) => d.name)
        .join(
          (enter) =>
            enter
              .append("text")
              .attr(
                "transform",
                (d) =>
                  `translate(${x((prev.get(d) || d).value)},${y(
                    (prev.get(d) || d).rank
                  )})`
              )
              .attr("y", y.bandwidth() / 2)
              .attr("x", -6)
              .attr("dy", "-0.25em")
              .text((d) => d.name)
              .call((text) =>
                text
                  .append("tspan")
                  .attr("fill-opacity", 0.7)
                  .attr("font-weight", "normal")
                  .attr("x", -6)
                  .attr("dy", "1.15em")
              ),
          (update) => update,
          (exit) =>
            exit
              .transition(transition)
              .remove()
              .attr(
                "transform",
                (d) =>
                  `translate(${x((next.get(d) || d).value)},${y(
                    (next.get(d) || d).rank
                  )})`
              )
              .call((g) =>
                g
                  .select("tspan")
                  .tween("text", (d) =>
                    textTween(d.value, (next.get(d) || d).value)
                  )
              )
        )
        .call((bar) =>
          bar
            .transition(transition)
            .attr("transform", (d) => `translate(${x(d.value)},${y(d.rank)})`)
            .call((g) =>
              g
                .select("tspan")
                .tween("text", (d) =>
                  textTween((prev.get(d) || d).value, d.value)
                )
            )
        ));
  }

  const formatNumber = d3.format(",.2f");

  function textTween(a, b) {
    const i = d3.interpolateNumber(a, b);
    return function (t) {
      this.textContent = formatNumber(i(t)) + "%";
    };
  }

  function axis(svg) {
    const g = svg.append("g").attr("transform", `translate(0,${margin.top})`);

    const axis = d3
      .axisTop(x)
      .ticks(width / 160)
      .tickSizeOuter(0)
      .tickSizeInner(-barSize * (n + y.padding()));

    return (_, transition) => {
      g.transition(transition).call(axis);
      g.select(".tick:first-of-type text").remove();
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
      g.select(".domain").remove();
    };
  }

  const formatDate = d3.utcFormat("%Y %m %d");

  function ticker(svg) {
    const now = svg
      .append("text")
      .style("font", `bold ${barSize}px var(--sans-serif)`)
      .style("font-variant-numeric", "tabular-nums")
      .attr("text-anchor", "end")
      .attr("x", width - mapWidth - margin.left)
      .attr("y", margin.top + barSize * (n - 0.45) + mapHeight / 2)
      .attr("dy", "0.32em")
      .text(formatDate(keyframes[0][0]));

    return ([date], transition) => {
      transition.end().then(() => now.text(formatDate(date)));
    };
  }

  const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);
  const y = d3
    .scaleBand()
    .domain(d3.range(n + 1))
    .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
    .padding(0.1);

  async function play() {
    const updateBars = bars(svg);
    const updateAxis = axis(svg);
    const updateLabels = labels(svg);
    const updateTicker = ticker(svg);
    const updateCircles = circles(mapLegend);

    for (const keyframe of keyframes) {
      const transition = svg
        .transition()
        .duration(duration)
        .ease(d3.easeLinear);

      // Extract the top bar’s value.
      x.domain([0, keyframe[1][0].value]);

      updateAxis(keyframe, transition);
      updateBars(keyframe, transition);
      updateLabels(keyframe, transition);
      updateTicker(keyframe, transition);
      updateCircles(keyframe, transition);

      await transition.end();
    }
  }

  play();

  // d3.select("#play-ribbons").on("click", () => {
  //   d3.select("#play-ribbons").classed("hide", true);
  //   d3.select("#pause-ribbons").classed("hide", false);
  //   play();
  // });
};
