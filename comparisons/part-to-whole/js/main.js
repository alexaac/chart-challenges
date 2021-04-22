import { responsivefy } from "/js/globalHelpers.js";

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

const zoomableGroup = svg
  .append("g")
  .attr("class", "zoomable-group")
  .attr(
    "transform",
    (d) => `translate(${[width / 2 + margin / 2, height / 2]})`
  );

const partition = d3.partition();

const zoom = d3.zoom().on("zoom", () => {
  const currentZoom = `translate(${width / 2 + d3.event.transform.x} ${
    height / 2 + d3.event.transform.y
  }) scale(${d3.event.transform.k})`;

  // rescale positions and dots
  zoomableGroup.attr("transform", currentZoom); // transform view
});
svg.call(zoom).on("dblclick.zoom", null);

// Get the data
d3.csv("data/siruta_uat_popf.csv").then(function (data) {
  // const filteredData = getOrderedData(data).slice(0, 20);

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

  const makePartition = (data) => {
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

    root.sum((d) => d.data.population).sort((a, b) => a.value - b.value);
    // .count();

    const partitionData = partition.size([2 * Math.PI, root.height + 1])(root);

    return partitionData;
  };

  const setLabel = (d) => {
    const base =
      d.x1 - d.x0 > 0
        ? d.depth === 0
          ? "România"
          : d.depth === 1
          ? `${d.data.data.regiune} - ${d.data.data.numeregiune}`
          : d.depth === 2
          ? `${d.data.data.cntname}`
          : d.depth === 3
          ? `${d.data.data.rang.toUpperCase()} ${d.data.data.denloc}`
          : `${d.data.data.denloc}`
        : "";
    return base;
  };

  const root = makePartition(data);

  root.each((d) => (d.current = d));

  const nodes = root.descendants();

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
  const fontScale = d3
    .scaleLinear()
    .domain(d3.extent(root.descendants(), (d) => d.depth).reverse())
    .range([10, 20]);

  const radius = height / 6;

  const arc = d3
    .arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius((d) => d.y0 * radius)
    .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));

  let path, label;

  drawNodes();
  drawLabels();

  function drawNodes() {
    path = zoomableGroup
      .selectAll("path")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("fill", (d) => colorScale(d.depth))
      .attr("fill-opacity", (d) =>
        arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0
      )
      .attr("d", (d) => arc(d.current));

    path
      .filter((d) => {
        return d.children;
      })
      .style("cursor", "pointer")
      .on("click", clicked);

    path.append("title").text((d) => {
      const name = setLabel(d);

      return (
        name +
        (d.height === 0
          ? ` - ${d.data.data.siruta} - ${d3.format(",")(d.value)} locuitori`
          : "")
      );
    });
  }

  function drawLabels() {
    label = zoomableGroup
      .selectAll("g.text")
      .data(nodes.slice(1))
      .join("text")
      .attr("dy", "0.35em")
      .attr("fill", (d) => (d.depth < 2 ? "white" : "black"))
      .attr("fill-opacity", (d) => +labelVisible(d.current))
      .style("font-size", (d) => fontScale(d.depth))
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .style("user-select", "none")
      .attr("transform", (d) => labelTransform(d.current))
      // .attr("x", (d) => arc.centroid(d)[0])
      // .attr("y", (d) => arc.centroid(d)[1] + 4)
      // .attr(
      //   "transform",
      //   (d) => `rotate(${(d.x0 + d.x1) / 2 - 90},${arc.centroid(d)})`
      // )
      .text((d) => setLabel(d));
  }

  const parent = zoomableGroup
    .append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);

  function clicked(p) {
    parent.datum(p.parent || root);

    root.each(
      (d) =>
        (d.target = {
          x0:
            Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          x1:
            Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth),
        })
    );

    const t = zoomableGroup.transition().duration(750);

    path
      .transition(t)
      .tween("data", (d) => {
        const i = d3.interpolate(d.current, d.target);
        return (t) => (d.current = i(t));
      })
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", (d) =>
        arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
      )
      .attrTween("d", (d) => () => arc(d.current));

    label
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      })
      .transition(t)
      .attr("fill-opacity", (d) => +labelVisible(d.target))
      .attrTween("transform", (d) => () => labelTransform(d.current));
  }

  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
};
