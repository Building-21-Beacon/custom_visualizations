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
          padding: 6px 10px;
          font:12px sans-serif;
          background: rgba(0,0,0,0.7);
          color: #fff; border-radius:4px;
          pointer-events:none; opacity:0; 
        }
        .legend-item text { font-size: 10px; fill: #333; }
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
    this._svg = d3.select(element).append('svg')
      .style('width','100%').style('height','100%');
    this._tooltip = d3.select(element).select('.tooltip');
  },
  updateAsync(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    if (!this._svg) this._initSvg(element);
    this._svg.selectAll('*').remove();

    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({ title:'Missing Fields', message:'1 dimension + 2 measures required: Competency, Performance, Growth.' });
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
    if (!pts.length) { this.addError({ title:'No Data', message:'No valid rows.' }); return done(); }

    const width = element.clientWidth;
    const height = element.clientHeight;
    const margin = 20;
    const radius = Math.max(0, Math.min(width, height)/2 - margin);

    // base SVG
    const svg = this._svg.attr('width', width).attr('height', height);
    const chartG = svg.append('g').attr('transform', `translate(${width/2},${height/2})`);

    // scales
    const maxPerf = d3.max(pts, d=>d.performance);
    const maxVal = Math.max(maxPerf, target);
    const rScale = d3.scaleLinear().domain([0, maxVal]).range([0, radius]);

    // color scale
    const palette = d3.schemeCategory10;
    const colorScale = d3.scaleOrdinal().domain(pts.map(d=>d.label)).range(palette);

    // compute arcs
    const pieGen = d3.pie().value(d=>d.growth).sort((a,b)=>d3.ascending(a.label,b.label)).padAngle(.03);
    const arcs = pieGen(pts);

    // draw arcs
    const arcGen = d3.arc().innerRadius(0).outerRadius(d=>rScale(d.data.performance));
    chartG.selectAll('path')
      .data(arcs).enter().append('path')
      .attr('d', arcGen)
      .style('fill', d=> {
        const base = colorScale(d.data.label);
        return d.data.performance >= target ? d3.color(base).darker(2).formatHex() : base;
      })
      .on('mouseover', (e,d)=>{
        this._tooltip.style('opacity',1)
          .html(`<strong>${d.data.label}</strong><br/>Performance: ${d.data.performance}<br/>Growth: ${d.data.growth}<br/>Target: ${target}`)
          .style('left',e.pageX+5+'px').style('top',e.pageY-28+'px');
      }).on('mouseout', ()=>this._tooltip.style('opacity',0));

    // target circle
    chartG.append('circle')
      .attr('r', rScale(target))
      .style('fill','none').style('stroke','#999').style('stroke-width',2).style('opacity',0.5);

    // labels outside slices
    const labelOffset = 20;
    chartG.selectAll('.label')
      .data(arcs).enter().append('text')
      .attr('x', d => Math.cos((d.startAngle+d.endAngle)/2 - Math.PI/2) * (rScale(d.data.performance) + labelOffset))
      .attr('y', d => Math.sin((d.startAngle+d.endAngle)/2 - Math.PI/2) * (rScale(d.data.performance) + labelOffset))
      .attr('text-anchor', d => ((d.startAngle+d.endAngle)/2) > Math.PI ? 'end' : 'start')
      .text(d => d.data.label);

    // LEGEND
    const legendG = svg.append('g').attr('class','legend')
      .attr('transform', `translate(${margin}, ${margin})`);
    const legendItems = legendG.selectAll('.legend-item')
      .data(pts).enter().append('g').attr('class','legend-item')
      .attr('transform', (d,i) => `translate(0, ${i * 18})`);
    legendItems.append('rect')
      .attr('width', 16).attr('height', 16)
      .style('fill', d => colorScale(d.label));
    legendItems.append('text')
      .attr('x', 16).attr('y', 6).attr('dy', '0.35em')
      .text(d => d.label)
      .style('font-sizel', 16);

    done();
  }
});
