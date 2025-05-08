looker.plugins.visualizations.add({
  id: "circular_performance_plot",
  label: "Circular Performance Plot",
  options: {},

  create: function(element, config) {
    console.log("🚀 Viz create called.");

    // Inject a style tag
    element.innerHTML = `
      <style>
        .aster-plot {
          width: 100%;
          height: 100%;
          min-height: 400px; /* ✅ Add a minimum height */
          display: flex;
          justify-content: center;
          align-items: center;
          box-sizing: border-box; /* ✅ Ensure padding/border don't collapse size */
          background: rgba(0, 255, 0, 0.1); /* Light green for debugging */
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

    // Load D3 if it's not present
    if (typeof d3 === 'undefined') {
      console.log("📦 D3 not found. Loading...");
      const script = document.createElement('script');
      script.src = 'https://d3js.org/d3.v5.min.js';
      script.onload = () => {
        console.log("✅ D3 loaded successfully.");
        this._setup(element);
      };
      script.onerror = () => {
        console.error("❌ Failed to load D3!");
      };
      document.head.appendChild(script);
    } else {
      console.log("✅ D3 is already loaded.");
      this._setup(element);
    }
  },

  _setup: function(element) {
    console.log("🔧 Setting up SVG and containers.");
    this._container = d3.select(element)
      .append("div")
      .attr("class", "aster-plot");

    this._svg = this._container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", "0 0 600 600")  // 👈 Makes scaling work well
      .attr("preserveAspectRatio", "xMidYMid meet");

    this._tooltip = d3.select(element).append("div")
      .attr("class", "tooltip");
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (typeof d3 === 'undefined') {
      console.warn("⚠️ D3 is not loaded yet. Skipping update.");
      done();
      return;
    }

    console.log("🔄 updateAsync called.");
    console.log("📊 Data received:", data);
    console.log("🧾 queryResponse:", queryResponse);

    // Basic data validation
    if (queryResponse.fields.dimensions.length < 2) {
      this.addError({
        title: "Invalid Data",
        message: "This chart requires at least 2 dimensions: Area and Value."
      });
      console.error("❌ Not enough dimensions.");
      done();
      return;
    }

    // Prepare data: assume 1st dim = Area, 2nd dim = Value
    const areaDim = queryResponse.fields.dimensions[0].name;
    const valueDim = queryResponse.fields.dimensions[1].name;

    const processedData = data.map(d => ({
      area: d[areaDim]?.value,
      value: +d[valueDim]?.value
    })).filter(d => d.area && !isNaN(d.value));

    console.log("✅ Processed data:", processedData);

    if (processedData.length === 0) {
      this.addError({
        title: "No Valid Data",
        message: "No valid data points to plot."
      });
      console.error("❌ No valid data after processing.");
      done();
      return;
    }

    // Clear previous SVG
    this._svg.selectAll("*").remove();

    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const radius = Math.min(width, height) / 2 - 30;
    console.log(`📐 width: ${width}, height: ${height}, radius: ${radius}`);

    const svg = this._svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.5)
      .outerRadius(d => radius * d.data[measureField.name].value)

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const arcs = svg.selectAll("arc")
      .data(pie(processedData))
      .enter()
      .append("g")
      .attr("class", "arc");

    arcs.append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => color(i))
      .on("mouseover", (event, d) => {
        this._tooltip.transition().duration(200).style("opacity", .9);
        this._tooltip
          .html(`<strong>${d.data[measureField.name].value}</strong><br/>Value: ${d.data.value}`)
          .style("left", (event.pageX) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        this._tooltip.transition().duration(500).style("opacity", 0);
      });

    // Add labels
    arcs.append("text")
      .attr("transform", d => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(d => d.data[measureField.name].value)
      .style("font-size", "10px")
      .style("fill", "#fff");

    console.log("✅ Rendering complete.");

    done();
  }
});
