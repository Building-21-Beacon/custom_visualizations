looker.plugins.visualizations.add({
  id: "circular_performance_growth",
  label: "Circular Performance & Growth",
  options: {
    target_value: { type: "number", label: "Global Target", default: 7 }
  },

  create(element) {
    element.innerHTML = `
      <style>
        .tooltip {
          position: absolute;
          padding: 8px 12px;
          font: 14px Poppins sans-serif;
          background: rgba(50, 50, 50, 0.9);
          color: #fff;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.1s ease;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .legend-item text { font-size: 12px; fill: #333; }
      </style>
      <div class="tooltip"></div>
    `;
    if (typeof d3 === 'undefined' || !d3.arc) {
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

    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({ title: 'Missing Fields', message: 'Requires 1 dimension + 2 measures: Competency, Performance, Growth.' });
      return done();
    }

    const dim = queryResponse.fields.dimensions[0].name;
    const perf = queryResponse.fields.measures[0].name;
    const growth = queryResponse.fields.measures[1].name;
    const target = +config.target_value || 0;

    const pts = data.map(d => ({
      label: d[dim].value,
      performance: +d[perf].value,
      growth: +d[growth].value
    })).filter(d => d.label && isFinite(d.performance) && isFinite(d.growth));
    if (!pts.length) { this.addError({ title: 'No Data', message: 'No valid rows.' }); return done(); }

    const width = element.clientWidth;
    const height = element.clientHeight;
    const margin = 20;
    const radius = Math.max(0, Math.min(width, height) / 2 - margin);
    const innerHole = radius * 0.2; // 20% hole

    const svg = this._svg.attr('width', width).attr('height', height);
    const chart = svg.append('g').attr('transform', `translate(${width/2},${height/2})`);

    const maxPerf = d3.max(pts, d => d.performance);
    const maxVal = Math.max(maxPerf, target);
    const rScale = d3.scaleLinear().domain([0, maxVal]).range([innerHole, radius]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(pts.map(d => d.label));

    const pieGen = d3.pie()
      .value(d => d.growth)
      .sort((a, b) => d3.ascending(a.label, b.label));
    const arcs = pieGen(pts);

    const arcGen = d3.arc()
      .innerRadius(innerHole)
      .outerRadius(d => rScale(d.data.performance))
      .padAngle(0.03)
      .padRadius(radius);

    chart.selectAll('path')
      .data(arcs).enter().append('path')
      .attr('d', arcGen)
      .style('fill', d => {
        const base = colorScale(d.data.label);
        return d.data.performance >= target ? d3.color(base).darker(1).formatHex() : base;
      })
      .on('mouseover', (event, d) => {
        this._tooltip
          .style('opacity', 1)
          .html(
            `<strong>${d.data.label}</strong><br/>` +
            `Performance: ${d.data.performance}<br/>` +
            `Growth: ${d.data.growth}<br/>` +
            `Target: ${target}`
          )
          .style('transform',
           `translate(${e.pageX+12}px, ${e.pageY-50}px)`)
      })
      .on('mouseout', () => this._tooltip.style('opacity', 0))
      .on('mousemove', (e, d) => {
       this._tooltip
         .style('transform',
           `translate(${e.pageX+12}px, ${e.pageY-50}px)`
         );
       });

    chart.append('circle')
      .attr('r', rScale(target))
      .style('fill', 'none')
      .style('stroke', '#999')
      .style('stroke-width', 3)
      .style('opacity', 0.5);

    const labelOffset = 20;
    const labelGroups = chart.selectAll('.label-group')
      .data(arcs).enter().append('g')
      .attr('class', 'label-group');
    
    labelGroups.append('line')
      .attr('x1', d => Math.cos((d.startAngle + d.endAngle) / 2 - Math.PI/2) * rScale(d.data.performance))
      .attr('y1', d => Math.sin((d.startAngle + d.endAngle) / 2 - Math.PI/2) * rScale(d.data.performance))
      .attr('x2', d => Math.cos((d.startAngle + d.endAngle) / 2 - Math.PI/2) * (rScale(d.data.performance) + labelOffset))
      .attr('y2', d => Math.sin((d.startAngle + d.endAngle) / 2 - Math.PI/2) * (rScale(d.data.performance) + labelOffset))
      .style('stroke', '#666')
      .style('stroke-width', '1px');

    labelGroups.append('text')
      .attr('x', d => Math.cos((d.startAngle + d.endAngle) / 2 - Math.PI/2) * (rScale(d.data.performance) + labelOffset + 4))
      .attr('y', d => Math.sin((d.startAngle + d.endAngle) / 2 - Math.PI/2) * (rScale(d.data.performance) + labelOffset + 4))
      .attr('text-anchor', d => ((d.startAngle + d.endAngle) / 2) > Math.PI ? 'end' : 'start')
      .attr('font-size', '16px')
      .attr('font-family', 'Poppins')
      .attr('fill', '#333')
      .text(d => d.data.label);

    const legendG = svg.append('g').attr('class', 'legend').attr('transform', `translate(${margin},${margin})`);
    legendG.selectAll('.legend-item')
      .data(pts).enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d,i) => `translate(0, ${i * 18})`)
      .call(g => {
        g.append('rect')
         .attr('width', 22).attr('height', 22)
         .style('fill', d => colorScale(d.label));
        g.append('text')
         .attr('x', 20).attr('y', 8)
         .attr('dy', '0.35em')
         .attr('font-size', '18px')
         .attr('font-family', 'Poppins')
         .text(d => d.label);
      });

    done();
  }
});
