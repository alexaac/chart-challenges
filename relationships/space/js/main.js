import { responsivefy } from "../../js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = 100,
  width = 1000,
  height = 1000;

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
  .attr("transform", (d) => `translate(${[0, 0]})`);

const zoom = d3.zoom().on("zoom", () => {
  let scale = d3.event.transform.k;

  const currentZoom = `translate(${d3.event.transform.x} ${d3.event.transform.y}) scale(${scale})`;

  zoomableGroup.attr("transform", currentZoom);
});

svg.call(zoom).call(zoom.scaleTo, 1.2);
// .call(zoom.translateBy, margin);

let starsDataHyg,
  cleanedStars = { type: "FeatureCollection", features: [] };

const rotate = { x: 0, y: 45 };

const flippedStereographic = (lambda, phi) => {
  var coslambda = Math.cos(lambda),
    cosphi = Math.cos(phi),
    k = 1 / (1 + coslambda * cosphi);
  return [-k * cosphi * Math.sin(lambda), k * Math.sin(phi)];
};

const projection = d3
  .geoProjection(flippedStereographic)
  .scale((2 * height) / Math.PI)
  .translate([width / 2 + margin / 2, height / 2 - margin])
  .clipAngle(90)
  .rotate([rotate.x, -rotate.y])
  .precision(0.1);

// const projection = d3
//   .geoStereographic()
//   .scale((1.5 * height) / Math.PI)
//   .translate([width / 2, height / 2])
//   .clipAngle(120)
//   .rotate([rotate.x, -rotate.y]);

// const projection = d3
//   .geoAiry()
//   .scale(360)
//   .translate([width / 2, height / 2])
//   .clipAngle(90)
//   .rotate([rotate.x, -rotate.y]);

const addLatLon = (starsDataHyg) => {
  /* Filter by magnitude - the star's apparent visual magnitude */
  const filtered = starsDataHyg.filter((d) => d.mag < 8);

  filtered.map((d) => {
    /* Longitudes and latitudes are obtained from declination and right ascension;
    longitude is inverted because the celestial sphere is seen from the inside */

    const lat = +d.dec;
    const lon = (+d.ra * 360) / 24;
    // const lon = (+d.ra * 360) / 24 - 180;
    const [x, y] = projection([-lon, lat]);

    cleanedStars.features.push({
      geometry: {
        coordinates: [x, y],
        type: "Point",
      },
      properties: {
        color: +d.ci,
        mag: +d.mag,
        name: d.proper,
        distance: +d.dist,
        lat: lat,
        lon: lon,
      },
      type: "Feature",
    });

    return d;
  });
};

// Load data
const promises = [d3.csv("data/hygdata_v3.csv")];

Promise.all(promises)
  .then((data) => {
    starsDataHyg = data[0];

    addLatLon(starsDataHyg);

    drawGraph();
  })
  .catch((error) => console.log(error));

const drawGraph = () => {
  const path = d3.geoPath().projection(projection);

  zoomableGroup
    .append("path")
    .datum({ type: "Sphere" })
    .attr("class", "celestial-sphere")
    .attr("d", path);

  const graticule = d3.geoGraticule();

  const lines = zoomableGroup
    .selectAll("path.graticule")
    .data([graticule()])
    .enter()
    .append("path")
    .attr("class", "graticule")
    .attr("d", path);

  const rScale = d3
    .scaleLinear()
    .domain(d3.extent(cleanedStars.features, (d) => d.properties.mag))
    .range([16, 0]);

  const cScale = d3
    .scaleLinear()
    .domain([-0.3, 0, 0.6, 0.8, 1.42])
    .range(["#6495ed", "#fff", "#fcff6c", "#ffb439", "#ff4039"]);

  path.pointRadius((d) => (d.properties ? rScale(d.properties.mag) : 1));

  var defs = svg.append("defs");

  var dropShadowFilter = defs
    .append("svg:filter")
    .attr("id", "drop-shadow")
    .attr("filterUnits", "userSpaceOnUse")
    .attr("width", "300%")
    .attr("height", "300%");
  dropShadowFilter
    .append("svg:feGaussianBlur")
    .attr("in", "SourceGraphic")
    .attr("stdDeviation", 5)
    .attr("result", "blur-out");
  dropShadowFilter
    .append("svg:feColorMatrix")
    .attr("in", "blur-out")
    .attr("type", "hueRotate")
    .attr("values", 180)
    .attr("result", "color-out");
  dropShadowFilter
    .append("svg:feOffset")
    .attr("in", "color-out")
    .attr("dx", 3)
    .attr("dy", 3)
    .attr("result", "the-shadow");
  dropShadowFilter
    .append("svg:feBlend")
    .attr("in", "SourceGraphic")
    .attr("in2", "the-shadow")
    .attr("mode", "normal");

  const stars = zoomableGroup
    .selectAll("path.star")
    .data(cleanedStars.features)
    .enter()
    .append("path")
    .attr("class", "star")
    // .attr("fill", "green")
    .attr("fill", (d) => cScale(d.properties.color))
    .style("filter", "url(#drop-shadow)")
    .attr("d", path);

  stars.append("title").text(
    (d) =>
      `${d.properties.name} ${Math.trunc(
        d.properties.distance * 3.262
      )} light years (${Math.trunc(d.properties.distance)} parsecs)` // parsecs to light years, multiply by 3.262
  );

  const name = zoomableGroup
    .selectAll("text")
    .data(cleanedStars.features)
    .enter()
    .append("text")
    .attr("class", "star-label")
    .attr("x", (d) => projection(d.geometry.coordinates)[0] + 8)
    .attr("y", (d) => projection(d.geometry.coordinates)[1] + 8)
    .text((d) => d.properties.name)
    .attr("fill", "white");

  const overlay = zoomableGroup
    .selectAll("circle")
    .data([rotate])
    .enter()
    .append("circle");

  overlay
    .attr("r", height / 2)
    .attr("transform", "translate(" + [width / 2, height / 2] + ")")
    .attr("fill-opacity", 0);

  const dragBehavior = d3.drag().on("drag", drag);

  overlay.call(dragBehavior);

  function drag(d) {
    projection.rotate([-(d.x = d3.event.x) / 2, -(d.y = d3.event.y) / 2]);
    // projection.rotate([(d.x = d3.event.x) / 2, -(d.y = d3.event.y) / 2]);

    stars.attr("d", function (u) {
      const p = path(u);
      return p ? p : "M 10 10";
    });

    lines.attr("d", path);

    name
      .attr("x", (d) => projection(d.geometry.coordinates)[0] + 8)
      .attr("y", (d) => projection(d.geometry.coordinates)[1] + 8);
  }
};
