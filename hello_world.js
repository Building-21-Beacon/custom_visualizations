looker.plugins.visualizations.add({
  id: "simple_aster_plot",
  label: "Simple Aster Plot",
  options: {},

  create(element, config) {
    console.log("🛠️ create() called");

    // Don’t force a huge height—just ensure a small minimum
    element.style.minHeight = "200px";

    element.innerHTML = `
      <style>
        .aster-plot {
          width: 100%;
          height: 100%;
          min-height: 200px;        /* ↓ lower min-height */
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .tooltip {
          position: absolute;
          padding: 4px 8px;
          font: 12px sans-serif;
          background: rgba(0,0,0,0.7);
          color: #fff;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0;
        }
      </style>
      <div class="aster-plot"></div>
      <div class="tooltip"></div>
    `;

    // Load D3 if missing
    if (typeof d3 === 'undefined') {
      console.log("📦 Loading D3…");
      const s = document.createElement('script');
      s.src = 'https://d3js.org/d3.v5.min.js';
      s.onload = () => {
        console.log("✅ D3 loaded");
        this._setup(element);
      };
      s.onerror = () => console.error("❌ Failed to load D3");
      document.head.appendChild(s);
    } else {
      console.log("✅ D3 already present");
      this._setup(element);
    }
  },

  _setup(element) {
    console.log("🔧 _setup()");
    this._container = d3.select(element).select('.aster-plot');
    this._tooltip = d3.select(element).select('.tooltip');

    // Responsive SVG using viewBox
    this._svg = this._container
      .append('svg')
      .attr('viewBox', '0 0 600 600')
      .attr('preserveAspectRatio', 'xMidYMid meet');
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    if (typeof d3 === 'undefined') return done();

    console.log("🔄 updateAsync()", data);

    if (!queryResponse.fields.dimensions.length || !queryResponse.fields.measures.length) {
      this.addError({ title: "Missing Fields", message: "Need 1 dimension + 1 measure." });
      return done();
    }

    const dim = queryResponse.fields.dimensions[0].name;
    const mea = queryResponse.fields.measures[0].name;

    const pts = data
      .map(d => ({ area: d[dim]?.value, value: +d[mea]?.value }))
      .filter(d => d.area && !isNaN(d.value));

    if (!pts.length) {
      this.addError({ title: "No Data", message: "No valid points to plot." });
      return done();
    }
    console.log("Processed pts:", pts);

    this._svg.selectAll('*').remove();
    const g = this._svg.append('g').attr('transform', 'translate(300,300)');

    const pie = d3.pie().value(() => 1).sort(null);
    const maxVal = d3.max(pts, d => d.value);

    const arc = d3.arc()
      .innerRadius(50)
      .outerRadius(d => 50 + (d.data.value / maxVal) * 250);

    const slices = g.selectAll('g.slice')
      .data(pie(pts))
      .enter()
      .append('g')
      .attr('class', 'slice');

    slices.append('path')
      .attr('d', arc)
      .attr('fill', (d,i) => d3.schemeCategory10[i % 10])
      .on('mouseover', (e,d) => {
        this._tooltip
          .style('opacity', 1)
          .html(`<strong>${d.data.area}</strong><br/>${d.data.value}`)
          .style('left', (e.pageX+5)+'px')
          .style('top', (e.pageY-28)+'px');
      })
      .on('mouseout', () => this._tooltip.style('opacity', 0));

    slices.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .text(d => d.data.area);

    console.log("✅ Aster plot rendered");
    done();
  }
});
