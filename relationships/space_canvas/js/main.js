let starsDataHyg,
  cleanedStars = { type: "FeatureCollection", features: [] };

const projectionName = "geoOrthographic";
const projection = d3[projectionName]().precision(0.1);

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
  const sphere = { type: "Sphere" };
  const graticule = d3.geoGraticule10();

  const magnitudeScale = d3
    .scaleLinear()
    .domain(d3.extent(cleanedStars.features, (d) => d.properties.mag))
    .range([16, 0]);

  const colorScale = d3
    .scaleLinear()
    .domain([-0.3, 0, 0.6, 0.8, 1.42])
    .range(["#6495ed", "#fff", "#fcff6c", "#ffb439", "#ff4039"]);

  const padding = 10;

  const width = 800;
  const getHeight = () => {
    const [[x0, y0], [x1, y1]] = d3
      .geoPath(projection.fitWidth(width, sphere))
      .bounds(sphere);

    const dy = Math.ceil(y1 - y0),
      l = Math.min(Math.ceil(x1 - x0), dy);

    projection.scale((projection.scale() * (l - 1)) / l).precision(0.2);

    return dy;
  };

  const height = getHeight();


  const zoom = d3.zoom().on("zoom", () => {
    let scale = d3.event.transform.k;

    const currentZoom = `translate(${d3.event.transform.x} ${d3.event.transform.y}) scale(${scale})`;

    zoomableGroup.attr("transform", currentZoom);
  });

  const context = d3
    .select("#chart")
    .append("canvas")
    .attr("width", width)
    .attr("height", height)
    .node()
    .getContext("2d");

  projection.fitExtent(
    [
      [10, 10],
      [width - padding, height - padding],
    ],
    cleanedStars
  );

  const path = d3.geoPath(projection, context);
  const graticulePath = d3.geoPath(projection, context);
  const starPath = d3
    .geoPath(projection, context)
    .pointRadius((d) => magnitudeScale(d.properties.mag));

  function render() {
    context.clearRect(0, 0, width, height);

    // sphere fill
    context.beginPath(),
      path(sphere),
      (context.fillStyle = "#1a055c"),
      context.fill();

    // graticule
    context.beginPath(),
      graticulePath(graticule),
      (context.strokeStyle = "#aaa"),
      context.stroke();

    // stars
    cleanedStars.features.forEach((star) => {
      context.beginPath();

      starPath(star);

      context.fillStyle = colorScale(star.properties.color);

      context.fill();
    });

    // context.fillStyle = "#000";
    // context.fillRect(0, 0, width, height);

    // sphere boundary
    context.beginPath(), path(sphere), context.stroke();
  }

  d3.select(context.canvas)
    .call(
      drag(projection)
        .on("drag.render", () => render())
        .on("end.render", () => render())
    )
    .call(() => render());

  function drag(projection) {
    let v0, q0, r0;

    function dragstarted() {
      v0 = versor.cartesian(projection.invert([d3.event.x, d3.event.y]));

      q0 = versor((r0 = projection.rotate()));
    }

    function dragged() {
      const v1 = versor.cartesian(
        projection.rotate(r0).invert([d3.event.x, d3.event.y])
      );

      const q1 = versor.multiply(q0, versor.delta(v0, v1));

      projection.rotate(versor.rotation(q1));
    }

    return d3.drag().on("start", dragstarted).on("drag", dragged);
  }
};
