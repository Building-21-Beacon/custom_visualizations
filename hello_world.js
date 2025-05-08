looker.plugins.visualizations.add({
  id: "dynamic_aster_plot",
  label: "Dynamic Aster Plot",
  options: {},

  create(element, config) {
    console.log("⚙️ create()");

    // Inject basic styles
    element.innerHTML = `
      <style>
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
      <div class="tooltip"></div>
    `;

    // Load D3 if needed
    if (typeof d3 === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://d3js.org/d3.v5.min.js';
      s.onload = () => {
        console.log("✅ D3 loaded");
        this._initSvg(element);
      };
      document.head.appendChild(s);
    } else {
      this._initSvg(element);
    }
  },

  _initSvg(element) {
    console.log("🔧 _initSvg()");
    // Create an SVG that we'll resize on each update
    this._svg = d3.select(element)
      .append('svg')
      .style('width', '100%')
      .style('height', '100%');
    this._tooltip = d3.select(element).select('.tooltip');
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    if (typeof d3 === 'undefined') {
      console.warn("🌱 D3 not ready");
      return done();
    }

    console.log("🔄 updateAsync()", data);

    // Need 1 dimension + 1 measure
    if (queryResponse.fields.dimensions.length < 1 ||
        queryResponse.fields.measures.length < 1) {
      this.addError({
        title: "Missing Data",
        message: "Requires 1 dimension & 1 measure."
      });
      return done();
    }

    const dim = queryResponse.fields.dimensions[0].name;
    const mea = queryResponse.fields.measures[0].name;

    // Map to simple objects
    const pts = data
      .map(d => ({ area: d[dim]?.value, value: +d[mea]?.value }))
      .filter(d => d.area != null && !isNaN(d.value));

    if (pts.length === 0) {
      this.addError({ title: "No Data", message: "No valid points." });
      return done();
    }

    // Get actual pixel size
    const w = element.clientWidth;
    const h = element.clientHeight;
    console.log(`▶️ size: ${w}×${h}`);

    // Clear & resize SVG
    this._svg.selectAll('*').remove();
    this._svg
      .attr('width', w)
      .attr('height', h);

    // Center group
    const g = this._svg
      .append('g')
      .attr('transform', `translate(${w/2},${h/2})`);

    // Build aster: equal angles
    const pie = d3.pie().value(() => 1).sort(null);
    const maxVal = d3.max(pts, d => d.value);

    // Radii: inner 20%, outer up to 80% of min(w,h)/2
    const R = Math.min(w, h) / 2;
    const innerR = R * 0.2;
    const outerMax = R * 0.8;

    const arc = d3.arc()
      .innerRadius(innerR)
      .outerRadius(d => innerR + (d.data.value / maxVal) * (outerMax - innerR));

    // Draw slices
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
          .html(`<strong>${d.data.area}</strong><br>${d.data.value}`)
          .style('left', (e.pageX+5)+'px')
          .style('top', (e.pageY-28)+'px');
      })
      .on('mouseout', () => this._tooltip.style('opacity', 0));

    // Labels
    slices.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .text(d => d.data.area);

    console.log("✅ Rendered at dynamic size");
    done();
  }
});
