looker.plugins.visualizations.add({
  id: "perf_growth_radial",
  label: "Performance-Growth Radial",
  options: {},

  create(element, config) {
    console.log("⚙️ create()");
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
    // load D3
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
    this._svg = d3.select(element)
      .append('svg')
      .style('width', '100%')
      .style('height', '100%');
    this._tooltip = d3.select(element).select('.tooltip');
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    if (typeof d3 === 'undefined') return done();

    // need 1 dimension + 2 measures
    if (queryResponse.fields.dimensions.length < 1 ||
        queryResponse.fields.measures.length < 2) {
      this.addError({
        title: "Missing Fields",
        message: "Requires 1 dimension + 2 measures: Performance, Growth."
      });
      return done();
    }

    const dimName = queryResponse.fields.dimensions[0].name;
    const perfName = queryResponse.fields.measures[0].name;
    const growthName = queryResponse.fields.measures[1].name;

    // normalize
    const pts = data
      .map(d => ({
        area:      d[dimName]?.value,
        performance: +d[perfName]?.value,
        growth:      +d[growthName]?.value
      }))
      .filter(d => d.area && !isNaN(d.performance) && !isNaN(d.growth));

    console.log(pts)

    if (pts.length === 0) {
      this.addError({ title: "No Data", message: "No valid rows." });
      return done();
    }

    // measure ranges
    const totalPerf = d3.sum(pts, d => d.performance);
    const maxGrowth  = d3.max(pts, d => d.growth);

    // size
    const w = element.clientWidth;
    const h = element.clientHeight;
    const R = Math.min(w, h) / 2;
    const innerR = R * 0.1;         // small hole in center
    const outerMax = R * 0.9;       // leave 10% margin

    // clear + resize
    this._svg.selectAll('*').remove();
    this._svg.attr('width', w).attr('height', h);

    const g = this._svg
      .append('g')
      .attr('transform', `translate(${w/2},${h/2})`);

    // pie: angle ∝ performance
    const pie = d3.pie()
      .value(d => d.performance)
      .sort(null);

    // arc: radius ∝ growth
    const arc = d3.arc()
      .innerRadius(innerR)
      .outerRadius(d => innerR + (d.data.growth / maxGrowth) * (outerMax - innerR));

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // bind slices
    const slices = g.selectAll('g.slice')
      .data(pie(pts))
      .enter()
      .append('g')
      .attr('class', 'slice');

    // draw
    slices.append('path')
      .attr('d', arc)
      .attr('fill', (d,i) => color(i))
      .on('mouseover', (d,e) => {
        console.log(d)
        console.log(e)
        this._tooltip
          .style('opacity', 1)
          .html(`
            <strong>${d.data.area}</strong><br/>
            Perf: ${d.data.performance}<br/>
            Growth: ${d.data.growth}
          `)
          .style('left', (e.pageX+5)+'px')
          .style('top', (e.pageY-28)+'px');
      })
      .transition()
      .duration(100)
      .on('mouseout', () => this._tooltip.style('opacity', 0));

    // labels at mid‐radius of each slice
    slices.append('text')
      .attr('transform', d => {
        // compute mid‐angle centroid
        const c = arc.centroid(d);
        return `translate(${c[0]},${c[1]})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .text(d => d.data.area);

    console.log("✅ Rendered Perf-Growth radial chart");
    done();
  }
});
