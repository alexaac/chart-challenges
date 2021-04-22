import { responsivefy } from "../../js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = 140,
  width = 1000,
  height = 800;

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
  .attr("transform", (d) => `translate(${[margin, margin / 2]})`);

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

  let first10destromania = sorted
    .filter((d) => d[0] === "Romania")[0][1]
    .slice(0, 10);

  let first10destlabels = first10destromania.map((d) => d[0]);
  first10destlabels.push("Romania");
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

  const matrix = makeMatrix(arrayFromRollup);

  drawMatrix(matrix, labels);
});

const adjacencyMatrix = () => {
  let w = 1,
    h = 1;

  function layout(nodes, sourceMatrix) {
    const len = nodes.length;
    let value;

    const resultMatrix = [];
    for (let s = 0; s < sourceMatrix.length; s++) {
      for (let t = 0; t < sourceMatrix.length; t++) {
        const v = +sourceMatrix[s][t];
        const rect = {
          x: (t * w) / len,
          y: (s * h) / len,
          w: w / len,
          h: h / len,
        };
        if (v > 0) {
          const edge = {
            source: nodes[s],
            target: nodes[t],
            value: (value = v),
          };
          resultMatrix.push(Object.assign(edge, rect));
        } else {
          resultMatrix.push(Object.assign({}, rect));
        }
      }
    }
    return resultMatrix;
  }

  layout.size = function (array) {
    return arguments.length
      ? ((w = +array[0]), (h = +array[1]), layout)
      : [w, h];
  };

  return layout;
};

const drawMatrix = (matrix, labels) => {
  const matrixLayout = adjacencyMatrix().size([
    width - margin,
    height - margin,
  ]);
  const data = matrixLayout(labels, matrix);

  const color = d3
    .scaleSequential(d3.interpolateYlGnBu)
    .domain([0, d3.max(data, (d) => d.value)]);

  const cell = zoomableGroup
    .selectAll("g.cell")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "cell")
    .attr("transform", (d) => `translate(${[d.x, d.y]})`);

  cell
    .append("rect")
    .attr("height", (d) => d.h * 0.95)
    .attr("width", (d) => d.w * 0.95)
    .attr("rx", (d) => 0)
    .attr("ry", (d) => 0)
    .style("fill", (d) => (d.value ? color(d.value) : "white"));

  cell
    .append("text")
    .style("alignment-baseline", "middle")
    .style("text-anchor", "middle")
    .attr("x", (d) => d.w * 0.625)
    .attr("y", (d) => d.h * 0.625)
    .text((d) => (d.value ? d3.format(",")(d.value) : ""))
    .attr("font-size", "0.6rem")
    .style("fill", (d) => (d.value > 600000 ? "white" : "black"));

  zoomableGroup
    .selectAll("text.source")
    .data(data.filter((d) => d.y == 0))
    .enter()
    .append("text")
    .attr("class", "source")
    .attr("x", (d) => d.x + d.w / 2)
    .style("text-anchor", "middle")
    .attr("y", -15)
    .text((d, i) => labels[i]);

  zoomableGroup
    .selectAll("text.target")
    .data(data.filter((d) => d.x == 0))
    .enter()
    .append("text")
    .attr("class", "target")
    .attr("y", (d) => d.y + d.h / 2 + 7)
    .style("text-anchor", "end")
    .attr("x", -10)
    .text((d, i) => labels[i]);

  zoomableGroup
    .append("text")
    .style("text-anchor", "middle")
    .attr(
      "transform",
      `rotate(-90,${[0, height / 2 - margin / 2]}) translate(${[
        0,
        height / 2 - margin - 40,
      ]})`
    )
    .text("FROM");

  zoomableGroup
    .append("text")
    .style("text-anchor", "middle")
    .attr("transform", `translate(${[width / 2 - margin / 2, -45]})`)
    .text("TO");

  const legend_height = 15;

  const legend_svg = svg
    .append("g")
    .attr("transform", `translate(${margin / 4}, ${height - margin / 4})`);

  const defs = legend_svg.append("defs");

  const gradient = defs.append("linearGradient").attr("id", "linear-gradient");
  const extent = d3.extent(data.map((d) => d.value));

  const stops = [
    { offset: 0, value: extent[0] },
    { offset: 0.5, value: (extent[1] - extent[0]) / 2 },
    { offset: 1, value: extent[1] },
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
};
