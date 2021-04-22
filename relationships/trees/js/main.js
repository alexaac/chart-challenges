import { responsivefy } from "/js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = 200,
  width = 5000,
  height = 5000;

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
  .attr("transform", (d) => `translate(${[width / 2, height / 12]})`);

const tree = d3
  .tree()
  .size([width / 3, height / 3 - margin / 2])
  .separation((a, b) => (a.parent == b.parent ? 1 : 2) / (a.depth * a.depth));

const zoom = d3.zoom().on("zoom", () => {
  const currentZoom = `translate(${width / 2 + d3.event.transform.x} ${
    height / 2 + d3.event.transform.y
  }) scale(${d3.event.transform.k})`;

  // rescale positions and dots
  zoomableGroup.attr("transform", currentZoom);
});
svg.call(zoom).on("dblclick.zoom", null);

// Get the data
d3.csv("data/siruta_uat_popf.csv").then(function (data) {
  drawHierarchy(data);
});

const drawHierarchy = (data) => {
  function makeRoot(items) {
    const object = {
      key: "România",
      values: items,
    };
    return makeSubtree(object);
  }
  function makeSubtree(item) {
    let object = {
      id: item.key,
      data: { population: 0, area: 0, denloc: "" },
    };
    if (item.values) {
      if (item.values.length == 1) {
        // remove unnecessary nesting
        object = makeSubtree(item.values[0]);
      } else {
        object.children = [];
        item.values.forEach(function (value) {
          const subtree = makeSubtree(value);
          object.children.push(subtree);
          object.data = subtree.data;
        });
      }
    } else if (item.value) {
      object.data = item.value[0];
    }
    return object;
  }

  const partition = (data) => {
    data = data.filter((d) => +d["Pop 1Ian2020"] > 0 && d.Denjud !== "");

    let nestedData = d3
      .nest()
      .key((d) => d.Country)
      .key((d) => d.Regiune)
      // .key((d) => d["Nume Regiune"])
      .key((d) => d.Tip)
      .key((d) => d.Judet)
      // .key((d) => d.Niv)
      // .key((d) => d["Nat Level"])
      // .key((d) => d["Nat Level Name"])
      .key((d) => d.Sirsup)
      // .key((d) => d["Cnt Id"])
      // .key((d) => d["Cnt Name"])
      // .key((d) => d["Cnt Abbr"])
      .key((d) => d.Rang)
      .key((d) => d.Siruta)
      .rollup((d) =>
        d.map((c) => ({
          area: +c["Area Sqm Uat"],
          population: +c["Pop 1Ian2020"],
          regiune: c["Regiune"],
          numeregiune: c["Nume Regiune"],
          tip: c["Tip"],
          judet: c["Judet"],
          niv: c["Niv"],
          natlevel: c["Nat Level"],
          natlevelname: c["Nat Level Name"],
          sirsup: c["Sirsup"],
          cntid: c["Cnt Id"],
          cntname: c["Cnt Name"],
          cntabbr: c["Cnt Abbr"],
          rang: c["Rang"],
          siruta: c.Siruta,
          denloc: c.Denloc,
          numeuat: c["Nume Uat"],
        }))
      )
      .entries(data);

    // convert to custom hierarchy (id/children and data fields)
    const madeRoot = makeRoot(nestedData);

    const root = d3.hierarchy(madeRoot);

    root
      .sum((d) => d.data.population)
      .sort((a, b) => b.height - a.height || a.value - b.value);

    const treeRoot = tree(root);

    return treeRoot;
  };

  const setLabel = (d) => {
    const base =
      d.depth === 0
        ? "România"
        : d.depth === 1
        ? `${d.data.data.regiune} - ${d.data.data.numeregiune}`
        : d.depth === 2
        ? `${d.data.data.cntname}`
        : d.depth === 3
        ? `${d.data.data.denloc}`
        : `${d.data.data.denloc} - ${d.data.data.siruta} - ${
            d.data.data.rang ? d.data.data.rang.toUpperCase() : ""
          }`;

    return base;
  };

  const root = partition(data);

  const nodes = root.descendants();
  const links = root.links();

  // const colorScale = d3
  //   .scaleOrdinal(d3.schemePaired)
  //   .domain(d3.extent(nodes, (n) => n.depth));
  const colorScale = d3
    .scaleOrdinal()
    .domain(d3.extent(nodes, (n) => n.depth))
    .range([
      "var(--country)",
      "var(--region)",
      "var(--county)",
      "var(--unit)",
      "var(--rang)",
    ]);
  const radialLink = d3
    .linkRadial()
    .angle((d) => (d.x * Math.PI) / 180 + Math.PI / 2)
    .radius((d) => d.y);

  drawLinks();
  drawNodes();
  drawLabels();

  function drawLinks() {
    zoomableGroup
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link")
      .attr("d", radialLink)
      .style(
        "stroke-width",
        (d) => (d.target.height + 1) * (d.target.height + 1)
      )
      .style("opacity", (d) => d.target.depth * 0.25 * 0.6 + 0.4);
  }

  function drawNodes() {
    const nodesGroup = zoomableGroup
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `rotate(${d.x}) translate(${d.y})`)
      .append("circle")
      .classed("leaf", (d) => !d.children)
      .attr("r", (d) => (d.height + 3) * 5)
      .style("fill", (d) => colorScale(d.height))
      .on("mouseover", highlightPath)
      .on("mouseout", unHighlight);

    nodesGroup.append("title").text((d) => {
      const name = setLabel(d);

      return (
        name +
        `${
          d.height === 0 && d.data.data.population > 0
            ? " - " + d3.format(",")(d.data.data.population) + " locuitori"
            : ""
        }`
      );
    });
  }

  function drawLabels() {
    zoomableGroup
      .selectAll("g.node")
      .append("text")
      .text((d) => setLabel(d))
      .style("fill", (d) =>
        d.depth < 3 ? "white" : d.depth === 3 ? "black" : "grey"
      )
      .attr("transform", (d) =>
        d.height == 0
          ? `rotate(0) translate(15,5)`
          : `rotate(${-d.x}) translate(0,5)`
      )
      .style("text-anchor", (d) => (d.height != 0 ? "middle" : "start"))
      .style("font-size", (d) => 14 + d.height * d.height);
  }

  function highlightPath(node) {
    const steps = node.path(root);

    d3.selectAll(".node").classed("highlighted", (d) => steps.indexOf(d) >= 0);
    d3.selectAll(".node").classed("faded", (d) => steps.indexOf(d) < 0);

    d3.selectAll(".link").classed("faded", (d) => steps.indexOf(d.target) < 0);
    d3.selectAll(".link").classed(
      "highlighted",
      (d) => steps.indexOf(d.target) >= 0
    );
  }

  function unHighlight() {
    d3.selectAll(".node, .link").classed("faded highlighted", false);
  }
};
