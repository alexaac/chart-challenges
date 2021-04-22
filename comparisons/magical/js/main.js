import { responsivefy } from "../../../js/globalHelpers.js";

// set the dimensions and margins of the diagram
const margin = { top: 0, right: 0, bottom: 0, left: 0 },
  width = 1100 - margin.left - margin.right,
  height = 850 - margin.top - margin.bottom;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("class", "chart-group")
  .attr("width", width)
  .attr("height", height)
  .call(responsivefy);

let offset = 60;
let dataByName;

const zoomableGroup = svg
  .append("g")
  .attr("class", "zoomable-group")
  .attr(
    "transform",
    (d) => `translate(${[width / 2, height / 2]}) rotate(-${offset})`
  );

const colorScale = d3
  .scaleOrdinal()
  .domain(["Charms", "Unforgivable Curses", "Defensive Charms & Curses"])
  .range(["#3a1f14", "#723f2e", "#795547"]);

const drawBackground = () => {
  const numSpirals = 36;
  let spirals = Array.from({ length: numSpirals }, (_, spiral) =>
    Array.from(
      {
        length: 300,
      },
      (_, i) => ({
        i,
        spiral,
      })
    )
  );

  let gen = d3
    .radialLine()
    .curve(d3.curveLinearClosed)
    .radius(({ i }) => i * 4)
    .angle(
      ({ i, spiral }) =>
        Math.random() * (Math.PI / 40) + ((Math.PI * 2) / numSpirals) * spiral
    );

  zoomableGroup
    .selectAll("path")
    .data(spirals)
    .join("path")
    .attr("class", "sparks")
    .attr("d", gen)
    .attr("fill", (d, i) => (i % 2 === 0 ? "#ffffff" : "#d3b486"));
};

const drawPie = (data, innerRadius, outerRadius, gClass, offset) => {
  const pie = d3
    .pie()
    .sort(null)
    .value((d) => 1);

  const arc = d3.arc().outerRadius(outerRadius).innerRadius(innerRadius);

  const path = zoomableGroup
    .selectAll("path.arc")
    .data(pie(data))
    .enter()
    .append("g")
    .attr("class", (d) => `${gClass} ${d.data.class}`)
    .attr("id", (d) => d.data.name)
    .classed("arc", true)
    .on("mouseover", function (event) {
      const thisData = d3.select(event.target).data()[0];
      d3.selectAll(`.level2 ${thisData.data.parent} arc`).attr(
        "fill-opacity",
        0.6
      );

      let g = d3
        .select(this)
        .append("g")
        .attr("class", "text-group")
        .attr("transform", (d) => `rotate(${offset})`);

      g.append("text")
        .attr("class", "name-text")
        .text(dataByName.get(thisData.data.class)[0].title)
        .attr("text-anchor", "middle")
        // .attr("font-size", "0.6rem")
        .attr("dy", "-1.2em");

      g.append("text")
        .attr("class", "name-text")
        .text(() =>
          thisData.data.subclass === undefined
            ? ""
            : dataByName.get(thisData.data.subclass)[0].title
        )
        .attr("text-anchor", "middle")
        // .attr("font-size", "0.6rem")
        .attr("dy", ".6em");

      g.append("text")
        .attr("class", "name-text")
        .text(thisData.data.parent === undefined ? "" : thisData.data.title)
        .attr("text-anchor", "middle")
        // .attr("font-size", "0.6rem")
        .attr("dy", "2.4em");
    })
    .on("mouseout", function (event, d) {
      const thisData = d3.select(event.target).data()[0];
      d3.selectAll(`.${thisData.data.class}`).attr("fill-opacity", 1);

      d3.select(this)
        .attr("style", "stroke: none; cursor: none;")
        .select(".text-group")
        .remove();
    })
    .append("path")
    .classed("arc2", true)
    .attr("id", (d) => `arc-${d.data.name}`)
    .attr("d", arc)
    .style("fill", (d, i) => colorScale(d.data.class))
    .on("mouseover", function (d) {
      d3.select(this).attr("fill-opacity", 0.6).attr("cursor", "pointer");
    })
    .on("mouseout", function (d) {
      d3.select(this).attr("fill-opacity", 1).attr("cursor", "none");
    })
    .each(function (d, i) {
      const firstArcSection = /(^.+?)L/;
      let newArc = firstArcSection.exec(d3.select(this).attr("d"))[1];

      newArc = newArc.replace(/,/g, " ");
      if (d.endAngle > (90 * Math.PI) / 180) {
        const startLoc = /M(.*?)A/,
          middleLoc = /A(.*?)0 0 1/,
          endLoc = /0 0 1 (.*?)$/;

        let newStart, middleSec, newEnd;
        newEnd = startLoc.exec(newArc)[1];

        if (endLoc.exec(newArc)) {
          newStart = endLoc.exec(newArc)[1];
          middleSec = middleLoc.exec(newArc)[1];
          newArc = `M${newStart}A${middleSec}0 0 0${newEnd}`;
        } else {
          const middleLoc2 = /A(.*?)0 1 1/;
          const endLoc2 = /0 1 1 (.*?)$/;
          newStart = endLoc2.exec(newArc)[1];
          middleSec = middleLoc2.exec(newArc)[1];
          newArc = `M${newStart}A${middleSec}1 1 0${newEnd}`;
        }
      }
      zoomableGroup
        .append("path")
        .attr("class", "hiddenDonutArcs")
        .attr("id", "donutArc" + i + gClass)
        .attr("d", newArc)
        .style("fill", "none");
    });

  zoomableGroup
    .selectAll(".donutText")
    .data(pie(data))
    .enter()
    .append("text")
    // .attr("font-size", 12 + "px")
    .attr("class", "donutText")
    .attr("dy", (d, i) => (d.endAngle > (90 * Math.PI) / 180 ? 18 : -11))
    .append("textPath")
    .attr("startOffset", "50%")
    .style("text-anchor", "middle")
    .attr("xlink:href", (d, i) => `#donutArc${i}${gClass}`)
    .text((d) => `${d.data.title}`);
};

// Get the data
d3.json("data/spells.json").then(function (data) {
  const allData = [...data[0], ...data[1], ...data[2]];
  dataByName = d3.group(allData, (d) => d.name);

  drawBackground();

  drawPie(data[2], (450 * 2) / 3, (340 * 2) / 3, "level3", offset);
  drawPie(data[1], (256 * 2) / 3, (184 * 2) / 3, "level2", offset);
  drawPie(data[0], (150 * 2) / 3, (108 * 2) / 3, "level1", offset);

  let i = 0,
    playNow,
    playNow1;

  d3.select("#play-ribbons").on("click", () => {
    d3.select("#play-ribbons").classed("hide", true);
    d3.select("#pause-ribbons").classed("hide", false);
    i = 0;
    animateArcs();
    animateBackground();
  });
  d3.select("#pause-ribbons").on("click", () => {
    d3.select("#pause-ribbons").classed("hide", true);
    d3.select("#play-ribbons").classed("hide", false);
    pauseAnimations();
  });

  const pauseAnimations = () => {
    clearInterval(playNow);
    clearInterval(playNow1);
  };

  const animateArcs = () => {
    playNow = setInterval(() => {
      if (i >= allData.length) {
        clearInterval(playNow);
        clearInterval(playNow1);
        d3.select("#pause-ribbons").classed("hide", true);
        d3.select("#play-ribbons").classed("hide", false);
      }

      d3.selectAll(".arc").dispatch("mouseout");
      d3.selectAll(".arc2").dispatch("mouseout");

      if (i < allData - 1) i = 0;
      if (allData[i]) {
        d3.select(`#${allData[i].name}`).dispatch("mouseover");
        d3.select(`#arc-${allData[i].name}`).dispatch("mouseover");
      }
      i++;
    }, 1000);
  };

  const animateBackground = () => {
    playNow1 = setInterval(() => {
      animateSparks();
    }, 3000);
  };

  function animateSparks() {
    offset += 60;

    d3.selectAll(".sparks")
      .transition()
      .duration(3000)
      .ease(d3.easeLinear)
      .attr("transform", `rotate(${offset})`);
  }

  // const interpol_rotate = d3.interpolateString("rotate(60)", "rotate(-60)");
  // const interpol_rotate_back = d3.interpolateString("rotate(-60)", "rotate(60)");

  // function animateSparks() {
  //   d3.selectAll(".sparks")
  //     .transition()
  //     .duration(3000)
  //     .attrTween("transform", function (d, i, a) {
  //       return interpol_rotate;
  //     })

  //     .transition() //And rotate back again
  //     .duration(3000)
  //     .attrTween("transform", function (d, i, a) {
  //       return interpol_rotate_back;
  //     });

  //   // .on("end", animateSparks); //at end, call it again to create infinite loop
  // }
});
