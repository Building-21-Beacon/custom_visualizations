looker.plugins.visualizations.add({
  id: "circular_performance_growth",
  label: "Circular Performance & Growth",
  options: {
    target_value: {
      type: "number",
      label: "Global Target",
      default: 7
    }
  },

  create(element) {
    element.innerHTML = `
      <style>
        .tooltip { position: absolute; padding: 6px 10px; font: 12px sans-serif;
                   background: rgba(0,0,0,0.7); color: #fff; border-radius: 4px;
                   pointer-events: none; opacity: 0; }
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
    this._svg.selectAll('*').remove();

    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({ title: 'Missing Fields', message: 'Requires 1 dimension + 2 measures: Competency, Performance, Growth.' });
      return done();
    }

    const dim = queryResponse.fields.dimensions[0].name;
    const perf = queryResponse.fields.measures[0].name;
    const growth = queryResponse.fields.measures[1].name;
    const target = Number(config.target_value) || 0;

    const pts = data.map(d => ({
      label: d[dim].value,
      performance: +d[perf].value,
      growth: +d[growth].value
    })).filter(d => d.label && isFinite(d.performance) && isFinite(d.growth));
    if (!pts.length) { this.addError({ title:'No Data', message:'No valid rows.' }); return done(); }

    const width = element.clientWidth, height = element.clientHeight;
    const margin = 40, radius = Math.min(width, height)/2 - margin;
    const svg = this._svg.attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${width/2},${height/2})`);

    // scales
    const maxPerf = d3.max(pts, d=>d.performance), maxVal = Math.max(maxPerf, target);
    const rScale = d3.scaleLinear().domain([0, maxVal]).range([0, radius]);

    // pie for growth as angle
    const pie = d3.pie().value(d=>d.growth).sort((a,b)=>d3.ascending(a.label,b.label));
    const arcs = pie(pts);

    // arc generator with spacing
    const arcGen = d3.arc().innerRadius(0)
      .outerRadius(d=>rScale(d.data.performance))
      .padAngle(0.2).padRadius(0);

    // draw segments
    g.selectAll('path')
      .data(arcs)
      .enter().append('path')
      .attr('d', arcGen)
      .style('fill', d=>d.data.performance < target ? '#8cc540' : '#0070bb')
      .on('mouseover', (e,d)=>{
        this._tooltip.style('opacity',1)
          .html(`<strong>${d.data.label}</strong><br/>Perf: ${d.data.performance}<br/>Growth: ${d.data.growth}<br/>Target: ${target}`)
          .style('left', (e.pageX+5)+'px').style('top', (e.pageY-28)+'px');
      }).on('mouseout', ()=>this._tooltip.style('opacity',0));

    // target ring
    g.append('circle')
      .attr('r', rScale(target))
      .style('fill','none').style('stroke','#999').style('stroke-width',2).style('opacity',0.5);

    // labels outside arcs, always horizontal
    const labelOffset = 20;
    g.selectAll('.label')
      .data(arcs).enter().append('text')
      .attr('class','label')
      .attr('x', d=> Math.cos((d.startAngle+d.endAngle)/2 - Math.PI/2)*(rScale(d.data.performance)+labelOffset))
      .attr('y', d=> Math.sin((d.startAngle+d.endAngle)/2 - Math.PI/2)*(rScale(d.data.performance)+labelOffset))
      .attr('text-anchor', d=> ((d.startAngle+d.endAngle)/2 > Math.PI? 'end':'start'))
      .attr('font-size',10).style('fill','#333')
      .text(d=>d.data.label);

    done();
  }
});
