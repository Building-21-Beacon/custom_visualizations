looker.plugins.visualizations.add({
  id: "horizontal_performance_growth",
  label: "Horizontal Performance & Growth",
  options: {},

  create(element) {
    element.innerHTML = `
      <style>
        .tooltip { position: absolute; padding: 6px 10px; font: 12px sans-serif;
                   background: rgba(0,0,0,0.7); color: #fff; border-radius: 4px;
                   pointer-events: none; opacity: 0; }
        .legend-item text { font-size: 10px; fill: #333; }
      </style>
      <div class="tooltip"></div>
    `;
    if (typeof d3 === 'undefined' || !d3.scaleBand) {
      const script = document.createElement('script');
      script.src = 'https://d3js.org/d3.v6.min.js';
      script.onload = () => this._initSvg(element);
      document.head.appendChild(script);
    } else {
      this._initSvg(element);
    }
  },

  _initSvg(element) {
    this._svg = d3.select(element)
      .append('svg')
      .style('width', '100%')
      .style('height', '100%');
    this._tooltip = d3.select(element).select('.tooltip');
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    if (!this._svg) this._initSvg(element);
    this._svg.selectAll('*').remove();

    // need 1 dimension + 2 measures
    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({
        title: "Missing Fields",
        message: "Requires 1 dimension + 2 measures: Competency, Performance, Growth."
      });
      return done();
    }

    const dimName = queryResponse.fields.dimensions[0].name;
    const perfName = queryResponse.fields.measures[0].name;
    const growthName = queryResponse.fields.measures[1].name;

    const pts = data.map(d => ({
      competency: d[dimName].value,
      performance: +d[perfName].value,
      growth: +d[growthName].value
    })).filter(d => d.competency && !isNaN(d.performance) && !isNaN(d.growth));

    if (pts.length === 0) {
      this.addError({ title: "No Data", message: "No valid rows." });
      return done();
    }

    const margin = { top: 30, right: 20, bottom: 40, left: 100 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const svg = this._svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const chartG = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // scales
    const y = d3.scaleBand()
      .domain(pts.map(d => d.competency))
      .range([0, height])
      .padding(0.2);

    const maxPerf = d3.max(pts, d => d.performance);
    const x = d3.scaleLinear()
      .domain([0, maxPerf])
      .range([0, width]);

    // axes
    chartG.append('g')
      .call(d3.axisLeft(y));

    chartG.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(x));

    // draw bars: base (performance - growth) and growth segment
    chartG.selectAll('.bar-base')
      .data(pts)
      .enter().append('rect')
      .attr('class', 'bar-base')
      .attr('x', 0)
      .attr('y', d => y(d.competency))
      .attr('height', y.bandwidth())
      .attr('width', d => x(Math.max(0, d.performance - d.growth)))
      .style('fill', '#0070bb');

    chartG.selectAll('.bar-growth')
      .data(pts)
      .enter().append('rect')
      .attr('class', 'bar-growth')
      .attr('x', d => x(Math.max(0, d.performance - d.growth)))
      .attr('y', d => y(d.competency))
      .attr('height', y.bandwidth())
      .attr('width', d => x(d.growth))
      .style('fill', '#8cc540')
      .on('mouseover', (event, d) => {
        this._tooltip
          .style('opacity', 1)
          .html(`
            <strong>${d.competency}</strong><br/>
            Performance: ${d.performance}<br/>
            Growth: ${d.growth}
          `)
          .style('left', (event.pageX + 5) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => this._tooltip.style('opacity', 0));

    // Legend for segments
    const legendData = [
      { label: 'Base Performance', color: '#0070bb' },
      { label: 'Growth', color: '#8cc540' }
    ];
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top / 2})`);

    const legendItems = legend.selectAll('.legend-item')
      .data(legendData)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(${i * 150}, 0)`);

    legendItems.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .style('fill', d => d.color);

    legendItems.append('text')
      .attr('x', 16)
      .attr('y', 6)
      .attr('dy', '0.35em')
      .text(d => d.label);

    done();
  }
});

