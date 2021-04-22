// https://observablehq.com/@datadesk/isotype-grid

import { responsivefy, zoomGraph } from "../../../js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = { top: 0, right: 0, bottom: 0, left: 0, people: 10 },
  width = 900 - margin.left - margin.right,
  height = 900 - margin.top - margin.bottom;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("class", "chart-group")
  .attr("width", width)
  .attr("height", height)
  .call(responsivefy);

svg.call(zoomGraph);

const zoomableGroup = svg
  .append("g")
  .attr("class", "zoomable-group")
  .attr("transform", (d) => `translate(${[100, 100]})`);

const squares = 25;
const filled = "#698";
const empty = "#777";
const per_line = 10;
const cellSize = Math.floor(width / per_line) - margin.people;
const figures = 100;
const data = d3.range(figures);

const scale = d3
  .scaleLinear()
  .domain([0, per_line - 1])
  .range([0, cellSize * per_line]);

let def = svg
  .append("defs")
  .append("g")
  .attr("id", "person")
  .attr("transform", `scale(${1 / (1.1 * per_line)})`); //only cause this person is long

// Need to modify person shape - maybe more square?
def
  .append("path")
  .attr(
    "d",
    "M14 22L114.5 5L221 0L328 5L429 22L424 399L427 465L462 456.5L503 423L530 390V293.152L528.424 272.971L519 213L510 172L485.061 160.125L472 156.194L450.253 158.493L427 167L427.705 116.709L428.411 66.418L454 74H498L530 87L556 116L579 167L594 261L602 348L594 406.5L579 456.5L556 482L510 508L462 535L434 559L448 638L429 663L386 678.5L334 684L231.636 692.153C224.557 692.717 217.444 692.699 210.368 692.102L114.5 684L58.5 678.5L14 663L0 638L14 577L23 399L14 22Z"
  );

def
  .append("path")
  .attr(
    "d",
    "M39.6,23.2c0.5-2,2.7-12.1-3.6-12.1c0,0,0,0-0.1,0c0,0,0,0-0.1,0c-6.3,0-4.1,10.1-3.6,12.1"
  );

def
  .append("rect")
  .attr("x", "29.2")
  .attr("y", "51.5")
  .attr("width", "13.4")
  .attr("height", "37.8");

def
  .append("path")
  .attr(
    "d",
    "M44.8,91.1H27c-1.6,0-2.4-1.9-1.2-2.9l8.9-7.7c0.7-0.6,1.8-0.6,2.5,0l8.9,7.7C47.2,89.3,46.4,91.1,44.8,91.1z"
  );

zoomableGroup
  .append("g")
  .attr("id", "block-layer") // for styling if needed
  .selectAll("use") // def doesn't work unless you "use"
  .data(data)
  .enter()
  .append("use")
  .attr("xlink:href", "#person")
  .attr("id", (d) => "icon" + d)
  .attr("x", (d, i) => {
    const n = i % per_line;
    return scale(n);
  })
  .attr("y", (d, i) => {
    const n = Math.floor(i / per_line);
    return scale(n);
  })
  .attr("fill", (d, i) => (i < squares ? filled : empty)); // for the slider
