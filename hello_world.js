looker.plugins.visualizations.add({
  id: "stacked_radial_bars",
  label: "Stacked Radial Bars",
  options: {},

  create(element, config) {
    console.log("⚙️ create()");
    element.innerHTML = `
      <style>
        .tooltip {
          width: 15%;
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
    if (typeof d3 === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://d3js.org/d3.v6.min.js';
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
        message: "Requires 1 dimension + 2 measures: Area, Performance, Growth."
      });
      return done();
    }

    const dimName = queryResponse.fields.dimensions[0].name;
    const perfName = queryResponse.fields.measures[0].name;
    const growthName = queryResponse.fields.measures[1].name;

    const pts = data
      .map(d => ({
        area: d[dimName]?.value,
        performance: +d[perfName]?.value,
        growth: +d[growthName]?.value
      }))
      .filter(d => d.area && !isNaN(d.performance) && !isNaN(d.growth));

    console.log(pts);

    if (pts.length === 0) {
      this.addError({ title: "No Data", message: "No valid rows." });
      return done();
    }

    // Prepare data: group by area
    const areas = d3.groups(pts, d => d.area);

    const w = element.clientWidth;
    const h = element.clientHeight;
    const outerRadius = Math.min(w, h) / 2;
    const ringWidth = outerRadius / (areas.length + 1);  // +1 for padding

    this._svg.selectAll('*').remove();
    this._svg.attr('width', w).attr('height', h);

    const g = this._svg
      .append('g')
      .attr('transform', `translate(${w/2},${h/2})`);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw each ring (one ring per area)
    areas.forEach(([areaName, values], areaIndex) => {
      const innerR = ringWidth * areaIndex;
      const outerR = innerR + ringWidth * 0.9;  // 10% padding inside each ring

      const totalGrowth = d3.sum(values, d => d.growth);

      const pie = d3.pie()
        .value(d => d.growth)
        .sort(null);

      const arc = d3.arc()
        .innerRadius(innerR)
        .outerRadius(outerR);

      const slices = g.selectAll(`.slice-${areaIndex}`)
        .data(pie(values))
        .enter()
        .append('g')
        .attr('class', `slice-${areaIndex}`);

      slices.append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => color(i))
        .attr('stroke', '#fff')
        .attr('stroke-width', '1px')
        .on('mouseover', (d, e) => {
          this._tooltip
            .style('opacity', 1)
            .html(`
              <strong>${d.data.area}</strong><br/>
              Perf: ${d.data.performance}<br/>
              Growth: ${d.data.growth}
            `)
            .style('left', (e.pageX + 5) + 'px')
            .style('top', (e.pageY - 28) + 'px');
        })
        .on('mouseout', () => this._tooltip.style('opacity', 0));

      // Add area label in the middle of the ring
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('x', 0)
        .attr('y', -innerR - ringWidth / 2)
        .text(areaName)
        .style('fill', '#333')
        .style('font-size', '12px');
    });

    console.log("✅ Rendered Stacked Radial Bars");
    done();
  }
});

