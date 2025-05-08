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

  create(element, config) {
    element.innerHTML = `
      <style>
        .tooltip {
          position: absolute;
          padding: 6px 10px;
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
    this._svg.selectAll('*').remove();

    // require 1 dimension + 2 measures
    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({
        title: 'Missing Fields',
        message: 'Requires 1 dimension + 2 measures: Competency, Performance, Growth.'
      });
      return done();
    }

    const dim = queryResponse.fields.dimensions[0].name;
    const perf = queryResponse.fields.measures[0].name;
    const growth = queryResponse.fields.measures[1].name;
    const globalTarget = Number(config.target_value) || 0;

    const pts = data.map(d => ({
      label: d[dim].value,
      performance: +d[perf].value,
      growth: +d[growth].value,
      target: globalTarget
    })).filter(d => d.label && !isNaN(d.performance) && !isNaN(d.growth));

    if (!pts.length) {
      this.addError({ title: 'No Data', message: 'No valid rows.' });
      return done();
    }

    const width = element.clientWidth;
    const height = element.clientHeight;
    const margin = 40;
    const radius = Math.min(width, height) / 2 - margin;

    const g = this._svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width/2},${height/2})`);

    const x = d3.scaleBand()
      .domain(pts.map(d => d.label))
      .range([0, 2 * Math.PI])
      .padding(0.1);

    const maxPerf = d3.max(pts, d => d.performance);
    const maxVal = Math.max(maxPerf, globalTarget);
    const rScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([0, radius]);

    const minG = d3.min(pts, d => d.growth);
    const maxG = d3.max(pts, d => d.growth);
    const color = d3.scaleLinear()
      .domain([minG, (minG+maxG)/2, maxG])
      .range(['#d73027', '#fdae61', '#1a9850']);

    const perfArc = d3.arc()
      .innerRadius(0)
      .outerRadius(d => rScale(d.data.performance))
      .startAngle(d => x(d.data.label))
      .endAngle(d => x(d.data.label) + x.bandwidth())
      .padAngle(0.01)
      .padRadius(0);

    const targetArc = d3.arc()
      .innerRadius(rScale(globalTarget) - 2)
      .outerRadius(rScale(globalTarget) + 2)
      .startAngle(d => x(d.data.label))
      .endAngle(d => x(d.data.label) + x.bandwidth());

    const arcs = d3.pie().value(() => 1).sort((a,b) => x(a.label) - x(b.label))(pts);

    // performance segments
    g.selectAll('.perf')
      .data(arcs)
      .enter().append('path')
      .attr('class', 'perf')
      .attr('d', perfArc)
      .style('fill', d => color(d.data.growth))
      .on('mouseover', (event, d) => {
        this._tooltip
          .style('opacity', 1)
          .html(`<strong>${d.data.label}</strong><br/>Perf: ${d.data.performance}<br/>Growth: ${d.data.growth}<br/>Target: ${globalTarget}`)
          .style('left', (event.pageX + 5) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => this._tooltip.style('opacity', 0));

    // global target ring
    g.append('path')
      .datum({ data: {} })
      .attr('class', 'target')
      .attr('d', d3.arc()
        .innerRadius(rScale(globalTarget) - 2)
        .outerRadius(rScale(globalTarget) + 2)
        .startAngle(0)
        .endAngle(2 * Math.PI)
      )
      .style('fill', 'none')
      .style('stroke', '#999')
      .style('stroke-width', 2)
      .style('opacity', 0.5);

    // labels
    g.selectAll('text')
      .data(pts)
      .enter().append('text')
      .attr('text-anchor', d => (x(d.label) + x.bandwidth()/2 > Math.PI ? 'end' : 'start'))
      .attr('transform', d => {
        const angle = (x(d.label) + x.bandwidth()/2) - Math.PI/2;
        const r = radius + 12;
        return `rotate(${(angle*180/Math.PI)}) translate(${r},0)`;
      })
      .text(d => d.label)
      .attr('font-size', 10);

    done();
  }
});
