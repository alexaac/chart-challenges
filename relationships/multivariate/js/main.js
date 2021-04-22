import { responsivefy } from "../../../js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = 100,
  width = 1000,
  height = 800;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("class", "chart-group")
  .attr("width", width)
  .attr("height", height)
  .call(responsivefy);

const zoom = d3.zoom().on("zoom", (event) => {
  const currentZoom = `translate(${width / 2 + event.transform.x} ${
    height / 2 + event.transform.y
  }) scale(${event.transform.k})`;

  // rescale positions and dots
  zoomableGroup.attr("transform", currentZoom); // transform view
});
svg.call(zoom).on("dblclick.zoom", null);

const zoomableGroup = svg
  .append("g")
  .attr("class", "zoomable-group")
  .attr(
    "transform",
    (d) => `translate(${[width / 2 + margin / 2, height / 2]})`
  );

const makeMatrix = function (arrayFromRollup) {
  const matrix = [];

  for (let i = 0; i < arrayFromRollup.length; i++) {
    const line = [];
    const destinationArray = arrayFromRollup[i].value;

    for (let j = 0; j < destinationArray.length; j++) {
      line.push(arrayFromRollup[i].value[j][1]);
    }
    matrix.push(line);
  }

  return matrix;
};

// Get the data
d3.csv("data/bilateral_migrations_eu_2020.csv").then(function (data) {
  let nestedData = d3
    .rollups(
      data,
      (v) => d3.sum(v, (d) => d["People No"]),
      (d) => d["Country Origin Name"],
      (d) => d["Country Dest Name"]
    )
    .sort(function (a, b) {
      d3.ascending(a[1], b[1]);
    });

  const sorted = nestedData;
  sorted.forEach(function (d) {
    d[1].sort(function (a, b) {
      return d3.descending(+a[1], +b[1]);
    });
  });

  let first10destromania = sorted.filter((d) => d[0] === "Romania")[0][1];
  // .slice(0, 9);
  let first10destlabels = first10destromania.map((d) => d[0]);
  // first10destlabels.push("Romania");
  const labels = first10destlabels.sort();

  let arrayFromRollup = Array.from(nestedData, ([key, value]) => ({
    key,
    value,
  }))
    .filter((d) => {
      return first10destlabels.includes(d.key);
    })
    .filter((d) => {
      return first10destlabels.includes(d.key);
    })
    .map((d) => ({
      key: d.key,
      value: d.value
        .filter((v) => first10destlabels.includes(v[0]))
        .sort((a, b) => d3.ascending(a[0], b[0])),
    }))
    .sort((a, b) => d3.ascending(a.key, b.key));
  // .slice(0, 10);

  const matrix = makeMatrix(arrayFromRollup);

  drawMatrix(matrix, labels);
});

const drawMatrix = (matrix, labels) => {
  const chord = d3
    .chord()
    .padAngle(0.05)
    .sortGroups((a, b) => d3.descending(a, b))
    .sortSubgroups((a, b) => d3.descending(a, b));

  const chords = chord(matrix);

  const radius = height / 2 - margin / 2;

  const ribbon = d3.ribbon().radius(radius);

  const color = d3
    // .scaleSequential(d3.interpolateSinebow)
    .scaleSequential(d3.interpolateRainbow)
    .domain([0, matrix.length]);

  zoomableGroup
    .selectAll("path.ribbon")
    .data(chords)
    .enter()
    .append("path")
    .attr("class", "ribbon")
    .attr("id", (d) => `ribbon-${d.source.index}-${d.target.index}`)
    .attr("d", ribbon)
    .style("fill-opacity", 0.6)
    .style("fill", (d) => color(d.target.index))
    .on("mouseover", (event, d) => highlightRibbon(event, d))
    .on("mouseout", (d) => {
      d3.selectAll("path").classed("faded", false);
      d3.select(".tooltip").transition().style("opacity", 0);
    });

  const arc = d3
    .arc()
    .innerRadius(radius + 2)
    .outerRadius(radius + 30);

  zoomableGroup
    .selectAll("path.arc")
    .data(chords.groups)
    .enter()
    .append("path")
    .attr("class", "arc")
    .attr("id", (d, i) => `group-${i}`)
    .attr("d", arc)
    .style("fill", (d) => color(d.index))
    .on("mouseover", (event, d) => highlightNode(event, d))
    .on("mouseout", (d) => d3.selectAll("path").classed("faded", false));

  zoomableGroup
    .selectAll("text")
    .data(chords.groups)
    .join("text")
    // .attr("x", (d) => arc.centroid(d)[0])
    // .attr("y", (d) => arc.centroid(d)[1])
    // .attr(
    //   "transform",
    //   (d) =>
    //     `rotate(${
    //       ((arc.endAngle()(d) + arc.startAngle()(d)) * 90) / Math.PI
    //     },${arc.centroid(d)})`
    .attr("dx", 35)
    .attr("dy", 15)
    .append("textPath")
    .attr("class", "label")
    .attr("xlink:href", (d) => `#group-${d.index}`)
    .text((d) => (d.value > 600000 ? labels[d.index] : ""))
    .style("fill", (d) => contrast(color(d.index)));

  const tooltip = zoomableGroup
    .append("g")
    .attr("class", "tooltip hidden")
    .attr("transform", `translate(${[-75, -50]})`)
    .style("opacity", 0);
  tooltip
    .append("rect")
    .attr("width", 100)
    .attr("height", 100)
    .attr("rx", 10)
    .attr("ry", 10)
    .style("fill", "white")
    .style("opacity", 0.8)
    .style("stroke", "lightgray");

  const textFrom = tooltip
    .append("text")
    .attr("id", "from")
    .attr("x", 50)
    .attr("y", 25)
    .text("From ")
    .each(function (d) {
      d3.select(this).append("tspan").text("");
      d3.select(this).append("tspan").attr("x", 50).attr("dy", 15).text("");
    });

  const textTo = tooltip
    .append("text")
    .attr("id", "to")
    .attr("x", 50)
    .attr("y", 75)
    .text("From ")
    .each(function (d) {
      d3.select(this).append("tspan").text("");
      d3.select(this).append("tspan").attr("x", 50).attr("dy", 15).text("");
    });

  function highlightNode(event, node) {
    d3.selectAll("path.arc").classed("faded", (d) => !(d.index === node.index));

    d3.selectAll("path.ribbon").classed(
      "faded",
      (edge) => !(edge.source.index === node.index)
    );
  }

  function highlightRibbon(event, edge) {
    d3.selectAll("path.arc").classed("faded", (node) => {
      return !(
        node.index === edge.source.index || node.index === edge.target.index
      );
    });
    d3.selectAll("path.ribbon").classed("faded", (d) => !(d === edge));
    d3.select(".tooltip").transition().style("opacity", 1);
    d3.select("#from tspan:nth-child(1)").text(labels[edge.source.index]);
    d3.select("#to tspan:nth-child(1)").text(labels[edge.target.index]);
    d3.select("#from tspan:nth-child(2)").text(
      d3.format(",")(edge.source.value)
    );
    d3.select("#to tspan:nth-child(2)").text(d3.format(",")(edge.target.value));
  }

  function contrast(color) {
    const c = d3.rgb(color);
    return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 130 ? "black" : "white";
  }

  d3.select("#play-ribbons").on("click", () => {
    d3.select("#play-ribbons").classed("hide", true);
    d3.select("#pause-ribbons").classed("hide", false);
    playRibbons();
  });
  d3.select("#pause-ribbons").on("click", () => {
    d3.select("#pause-ribbons").classed("hide", true);
    d3.select("#play-ribbons").classed("hide", false);
    pauseRibbons();
  });

  let i = 0,
    playRibbonNow;

  const playRibbons = () => {
    if (i > chords.length) i = 0;

    playRibbonNow = setInterval(() => {
      if (chords[i] && chords[i].source && chords[i].target) {
        d3.select(
          `#ribbon-${chords[i].source.index}-${chords[i].target.index}`
        ).dispatch("mouseover");
        // d3.select(`#arc-${chords[i].source.index}`).dispatch("mouseover");
        i++;
      } else {
        i = 0;
      }
    }, 1000);
  };

  const pauseRibbons = () => {
    clearInterval(playRibbonNow);
  };
};
