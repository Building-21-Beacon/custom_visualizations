looker.plugins.visualizations.add({
  id: "aster_plot",
  label: "Aster Plot",
  options: {
    minRadius: {
      type: "number",
      label: "Minimum Radius",
      default: 30
    },
    maxRadius: {
      type: "number",
      label: "Maximum Radius",
      default: 100
    },
    color: {
      type: "string",
      label: "Bar Color",
      default: "#4CAF50"
    }
  },
  create: function(element, config) {
    this.addScript("https://d3js.org/d3.v5.min.js")
    .then(() => {
      console.log("D3 loaded:", d3.version);
    element.innerHTML = `
      <style>
          .aster-plot {
            width: 100%;
            height: 100%;
          }
          .tooltip {
            position: absolute;
            text-align: center;
            padding: 6px;
            font: 12px sans-serif;
            background: lightsteelblue;
            border: 0px;
            border-radius: 8px;
            pointer-events: none;
            opacity: 0;
          }
        </style>
      `;
    this._container = d3.select(element)
        .append("div")
        .attr("class", "aster-plot");

      this._svg = d3.select(element).select(".aster-plot")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("min-height", "400px");  // Important: ensure visible size

      // Tooltip
      this._tooltip = d3.select(element).append("div")
        .attr("class", "tooltip");
    });
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (typeof d3 === "undefined") {
      console.warn("D3 not yet loaded, skipping render");
      done();
      return;
    }
    this.clearErrors();

    if (queryResponse.fields.dimensions.length === 0 || queryResponse.fields.measures.length === 0) {
      this.addError({
        title: "Missing Fields",
        message: "This chart requires at least one dimension and one measure."
      });
      return;
    }

    const width = element.clientWidth;
    const height = element.clientHeight;
    const radius = Math.min(width, height) / 2;
    const minRadius = config.minRadius || 30;
    const maxRadius = config.maxRadius || radius - 20;
    const color = config.color || "#4CAF50";

    const svg = this._svg;
    svg.selectAll("*").remove(); // clear previous

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const tooltip = this._tooltip;

    const arc = d3.arc()
      .innerRadius(minRadius)
      .outerRadius(d => minRadius + (maxRadius - minRadius) * d.value / 100);

    const pie = d3.pie()
      .value(1)
      .sort(null);

    // Prepare data
    const dimName = queryResponse.fields.dimensions[0].name;
    const measureName = queryResponse.fields.measures[0].name;

    const plotData = data.map(d => ({
      label: LookerCharts.Utils.textForCell(d[dimName]),
      value: +LookerCharts.Utils.textForCell(d[measureName])
    }));

    // Draw slices
    const slices = g.selectAll(".arc")
      .data(pie(plotData))
      .enter()
      .append("g")
      .attr("class", "arc");

    slices.append("path")
      .attr("d", arc)
      .attr("fill", color)
      .on("mouseover", function(d) {
        tooltip
          .style("opacity", 1)
          .html(`<strong>${d.data.label}</strong><br>${d.data.value}%`)
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
      });

    // Add labels at the outer edge
    slices.append("text")
      .attr("transform", function(d) {
        const [x, y] = arc.centroid(d);
        const scale = (maxRadius + 15) / Math.sqrt(x * x + y * y);
        return `translate(${x * scale},${y * scale})`;
      })
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .style("font-size", "10px")
      .text(d => d.data.label);

    done();
  }
});
