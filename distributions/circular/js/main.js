import { responsivefy } from "../../../js/globalHelpers.js";

// set the dimensions and margins of the diagram
// set the dimensions and margins of the diagram
const margin = 200,
  width = 1000 - margin,
  height = 600 - margin;

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
  .attr("transform", (d) => `translate(${[margin / 2, margin / 2]})`);

let nodes;

const dataSourceType = d3.select("#data-source").node().value;
const dataSource = dataSourceType === "sectoare" ? "data/siruta_uat_popb.csv" : "data/siruta_uat_buc.csv";

// Get the data
d3.csv(dataSource).then(function (data) {
  draw(data);
});

const draw = (data) => {
  // data = data.slice(0, 90);

  nodes = data
    .filter((d) => +d["Pop 1Ian2020"] > 0)
    .map((d) => ({
      node: d["Nume Uat"],
      name: d["Nume Regiune"],
      value: +d["Pop 1Ian2020"],
    }));

  const min_pop = d3.min(nodes, (d) => d.value);
  const max_pop = d3.max(nodes, (d) => d.value);

  const color = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([min_pop, max_pop]);

  const xScale = d3.scaleLinear().domain([min_pop, max_pop]).range([0, width]);
  // .clamp(true);
  const rScale = d3.scaleSqrt().domain([min_pop, max_pop]).range([0, 50]);

  const force = d3
    .forceSimulation(nodes)
    .force("forceX", d3.forceX((d) => xScale(d.value)).strength(2))
    .force("forceY", d3.forceY(height / 2).strength(0.1))
    .force(
      "collide",
      d3.forceCollide((d) => rScale(d.value) + 2)
    )
    .stop();

  for (let i = 0; i < 30; ++i) {
    force.tick();
  }

  force.stop();

  // Results
  drawChart();
  drawLegend();

  function drawChart() {
    const nodesGroup = zoomableGroup
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => rScale(d.value))
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .style("fill", (d) => color(d.value))
      .attr("fill-opacity", "0.7")
      .on("mouseover", highlightNode)
      .on("mouseout", unHighlight);

    nodesGroup
      .append("title")
      .text((d) => `${d.node} - ${d3.format(",")(d.value)}`);

    zoomableGroup
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d) => (d.value > 150000 ? d.node : ""))
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y);

    zoomableGroup
      .append("g")
      .call(d3.axisTop(xScale))
      .style("transform", `translateY(${height + margin}px`);

    const legend_height = 15;

    const legend_svg = zoomableGroup
      .append("g")
      .attr("transform", `translate(0, ${height + margin + 50})`);

    const defs = legend_svg.append("defs");

    const gradient = defs
      .append("linearGradient")
      .attr("id", "linear-gradient");

    const stops = [
      { offset: 0, value: min_pop },
      { offset: 0.5, value: (max_pop - min_pop) / 2 },
      { offset: 1, value: max_pop },
    ];

    gradient
      .selectAll("stop")
      .data(stops)
      .enter()
      .append("stop")
      .attr("offset", (d) => 100 * d.offset + "%")
      .attr("stop-color", (d) => color(d.value));

    legend_svg
      .append("rect")
      .attr("width", width)
      .attr("height", legend_height)
      .style("fill", "url(#linear-gradient)");

    legend_svg
      .selectAll("text")
      .data(stops)
      .enter()
      .append("text")
      .attr("x", (d) => width * d.offset)
      .attr("dy", -3)
      .style("text-anchor", (d, i) =>
        i == 0 ? "start" : i == 1 ? "middle" : "end"
      )
      .text((d, i) => d3.format(",")(d.value) + (i == 2 ? " people >" : ""));
  }

  function highlightNode(node) {
    d3.selectAll("circle").classed("highlight", (d) => d === node);
    d3.selectAll("circle").classed("faded", (d) => !(d === node));
  }

  function unHighlight() {
    d3.selectAll("circle").classed("faded highlight", false);
  }

  function drawLegend() {}
};
