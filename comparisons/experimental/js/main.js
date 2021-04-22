import { responsivefy } from "/js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = 40,
  width = 1100,
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
  .attr("transform", (d) => `translate(${[margin / 2, margin / 2]})`);

const tooltip_div = d3
  .select("body")
  .append("tooltip_div")
  .attr("class", "tooltip")
  .style("opacity", 0)
  .style("display", "none");

tooltip_div.append("div").classed("tooltip__text", true);
tooltip_div
  .append("div")
  .append("button")
  .classed("tooltip__remove", true)
  .on("click", function () {
    tooltip_div.transition().duration(200).style("opacity", 0);
  })
  .text("x");

const highlight = (d) => {
  tooltip_div.transition().duration(200).style("opacity", 0.9);
};

const showInfo = (d) => {
  d3.event.preventDefault();

  let left = d3.event.pageX / 1.5;
  let top = d3.event.pageY / 1.5;

  if (window.innerWidth - left < 150) {
    left = d3.event.pageX - 40;
  }

  tooltip_div.transition().duration(200).style("opacity", 0.9);

  tooltip_div.select(".tooltip__text").html(() => {
    let source = d.article
      ? `<a href="${d.article}" target="_blank">${d.article}</a>`
      : "";
    let cite = d.article
      ? `<q>${d.story ? d.story.replace(/\n/g, "<br />") : ""}</q>`
      : "";
    return `<strong>${d.title} - ${d3.format("$,.2d")(d.max_amount)} <br /> (${
      d.year
    })</strong> <br /><br />
          <img src="./img/${d.name}_band.png" width="200" alt="&copy; ${
      d.photo_copyright
    }" title="&copy; ${d.photo_copyright}"/>
          <img src="./img/${d.name}.png" width="100" alt="&copy; ${
      d.icon_copyright
    }" title="&copy; ${d.icon_copyright}"/>
          ${d.story ? cite : ""} <br /><br />
          Source: ${source} (${d.article_date})`;
  });
  tooltip_div
    .style("left", left + "px")
    .style("top", top + "px")
    .style("display", null);
};

const regionColor = function (region) {
  var colors = {
    "12-inch double vinyl, 33-1/3 rpm": "#596F7E",
    "10-inch acetate, 78 rpm": "#168B98",
    "7-inch vinyl, 45 rpm": "#ED5B67",
    "12-inch vinyl, 33-1/3 rpm": "#fd8f24",
    "12-inch acetate, 33-1/3 rpm": "#919c4c",
    "10-inch shellac, 78 rpm": "#910c4c",
    "10-inch vinyl, 33-1/3 rpm": "#310c4c",
    "10-inch vinyl, 78 rpm": "#960c4c",
  };
  return colors[region];
};

function colorHierarchy(hierarchy) {
  if (hierarchy.depth === 0) {
    hierarchy.color = "black";
  } else if (hierarchy.depth === 1) {
    hierarchy.color = regionColor(hierarchy.data.key);
  } else {
    hierarchy.color = hierarchy.parent.color;
  }
  if (hierarchy.children) {
    hierarchy.children.forEach((child) => colorHierarchy(child));
  }
}

// Get the data
d3.json("data/most_valuable_vinyl_records.json").then(function (data) {
  const filteredData = data.sort(function (a, b) {
    return b.max_amount - a.max_amount;
  });

  drawHierarchy(data);
});

const drawHierarchy = (data) => {
  const split = "year";
  const value = "max_amount";
  const group = "format";
  const shapechoice = "circle";

  const voronoi = zoomableGroup.append("g");
  const labels = zoomableGroup.append("g");
  const val_labels = zoomableGroup.append("g");

  const edgeCount = 200;
  const rotation = 0;

  const shape = d3.range(edgeCount).map((i) => {
    const rad = rotation + (i / edgeCount) * 2 * Math.PI;
    return [
      (width - margin) / 2 + ((width - margin) / 2) * Math.cos(rad),
      (height - margin) / 2 + ((height - margin) / 2) * Math.sin(rad),
    ];
  });

  let seed = new Math.seedrandom(Math.floor(Math.random() * 100));

  let voronoiTreeMap = d3.voronoiTreemap().prng(seed).clip(shape);

  let freedom_nest = d3
    .nest()
    .key((d) => d[group])
    // .key((d) => d[split])
    .key((d) => d.name)
    .rollup((v) => d3.sum(v, (d) => d[value]))
    .entries(data);

  let byName = d3
    .nest()
    .key((d) => d.name)
    .object(data);

  const data_nested = { key: "nested_group", values: freedom_nest };
  const dataHierarchy = d3
    .hierarchy(data_nested, (d) => d.values)
    .sum((d) => d.value);

  voronoiTreeMap(dataHierarchy);
  colorHierarchy(dataHierarchy);

  let allNodes = dataHierarchy
    .descendants()
    .sort((a, b) => b.depth - a.depth)
    .map((d, i) => Object.assign({}, d, { id: i }));

  let hoveredShape = null;

  var defs = svg.append("svg:defs");

  allNodes.forEach((d) => {
    defs
      .append("svg:pattern")
      .attr("id", d.data.key)
      .attr("width", "100")
      .attr("height", "80")
      .attr("patternUnits", "userSpaceOnUse")
      // .attr("patternTransform", "rotate(-45)")
      .attr("preserveAspectRatio", "xMidYMid slice")
      .append("svg:image")
      .attr("xlink:href", `./img/${d.data.key}_band.png`)
      .attr("width", "90")
      // .attr("height", "90")
      .attr("x", 0)
      .attr("y", 0);
  });

  voronoi
    .selectAll("path")
    .data(allNodes)
    .enter()
    .append("path")
    .attr("d", (d) => "M" + d.polygon.join("L") + "Z")
    .style("fill-opacity", "0.7")
    .attr("pointer-events", (d) => (d.depth === 2 ? "all" : "none"))
    .style("fill", (d) => `url(#${d.data.key})`)
    .attr("class", "path")
    .on("click", (d) => {
      if (d.data.key && byName[d.data.key]) {
        highlight(byName[d.data.key][0]);
        showInfo(byName[d.data.key][0]);
      }
    })
    .append("title")
    .text((d) => {
      return byName[d.data.key] !== undefined
        ? `${byName[d.data.key][0].title} - ${d3.format("$,.2d")(
            byName[d.data.key][0].max_amount
          )}`
        : "";
    })
    .on("mouseover", (d) => showInfo(d.data.key[0]))
    .transition()
    .duration(1000)
    .attr("stroke-width", (d) => 4 - d.depth * 2.8);

  labels
    .selectAll("text")
    .data(allNodes.filter((d) => d.depth === 2))
    .enter()
    .append("text")
    .attr("class", (d) => `label-${d.id}`)
    .attr("text-anchor", "middle")
    .attr(
      "transform",
      (d) => "translate(" + [d.polygon.site.x, d.polygon.site.y + 6] + ")"
    )
    .text((d) => byName[d.data.key][0].title)
    .attr("opacity", (d) => {
      return d.data.key === hoveredShape ? 1 : 0;
    })
    .attr("cursor", "default")
    .attr("pointer-events", "none")
    .attr("fill", "black")
    .style("font-size", "12px")
    .style("font-family", "Montserrat")
    .clone(true)
    .lower();

  // labels
  //   .selectAll("image")
  //   .data(allNodes.filter((d) => d.depth === 2))
  //   .enter()
  //   .append("image")
  //   .classed("node-icons", true)
  //   .attr("xlink:href", (d) => `./img/${d.data.key}.png`)
  //   .attr("x", "-12px")
  //   .attr("y", "-12px")
  //   .attr("width", "30px")
  //   .attr("height", "30px")
  //   .on("touchstart mouseover", (d) => highlight(byName[d.data.key][0]))
  //   .on("click", (d) => {
  //     highlight(byName[d.data.key][0]);
  //     showInfo(byName[d.data.key][0]);
  //   })
  //   .attr(
  //     "transform",
  //     (d) => "translate(" + [d.polygon.site.x, d.polygon.site.y + 6] + ")"
  //   );

  // val_labels
  //   .selectAll("text")
  //   .data(allNodes.filter((d) => d.depth === 2))
  //   .enter()
  //   .append("text")
  //   .attr("class", (d) => `label-${d.id}`)
  //   .attr("text-anchor", "middle")
  //   .attr(
  //     "transform",
  //     (d) => "translate(" + [d.polygon.site.x, d.polygon.site.y + 25] + ")"
  //   )
  //   .text((d) => d3.format("$,.2d")(d.data.value))
  //   .attr("cursor", "default")
  //   .attr("pointer-events", "none")
  //   .attr("fill", "black")
  //   .style("font-size", "12px")
  //   .style("font-family", "Montserrat");
};
