looker.plugins.visualizations.add({
  id: "lighthouse_bars",
  label: "Lighthouse Bars",
  options: {},

  create(element, config) {
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
    if (typeof d3 === 'undefined' || !d3.scaleBand) {
      const s = document.createElement('script');
      s.src = 'https://d3js.org/d3.v6.min.js';
      s.onload = () => this._initSvg(element);
      document.head.appendChild(s);
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

    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({ title: "Missing Fields", message: "Requires 1 dimension + 2 measures: Competency, Performance, Target." });
      return done();
    }

    const dimName = queryResponse.fields.dimensions[0].name;
    const perfName = queryResponse.fields.measures[0].name;
    const targetName = queryResponse.fields.measures[1].name;

    const pts = data.map(d => ({
      competency: d[dimName].value,
      performance: +d[perfName].value,
      target: +d[targetName].value
    })).filter(d => d.competency && !isNaN(d.performance) && !isNaN(d.target));

    if (!pts.length) {
      this.addError({ title: "No Data", message: "No valid rows." });
      return done();
    }

    const w = element.clientWidth;
    const h = element.clientHeight;
    const margin = { top: 40, right: 20, bottom: 60, left: 20 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const g = this._svg.attr('width', w).attr('height', h)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(pts.map(d => d.competency)).range([0, innerW]).padding(0.4);
    const maxVal = d3.max(pts, d => Math.max(d.performance, d.target));
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([innerH, 0]);

    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x))
      .selectAll("text").attr('dy', '0.75em');

    const towers = g.selectAll('.lighthouse').data(pts).enter().append('g')
      .attr('class', 'lighthouse')
      .attr('transform', d => `translate(${x(d.competency) + x.bandwidth()/2},0)`)
      .on('mouseover', function(event, d) {
        d3.select(this).select('polygon').style('fill', '#2980b9');
        d3.select('.tooltip').style('opacity', 1).html(`<strong>${d.competency}</strong><br/>Perf: ${d.performance}<br/>Target: ${d.target}`)
          .style('left', (event.pageX + 5) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).select('polygon').style('fill', '#3498db');
        d3.select('.tooltip').style('opacity', 0);
      });

    // Draw lighthouse shape (trapezoid)
    towers.append('polygon')
      .attr('points', d => {
        const baseW = x.bandwidth()/2;
        const topW = baseW * 0.4;
        const y0 = innerH;
        const y1 = y(d.performance);
        return `
          ${-baseW},${y0} ${baseW},${y0}
          ${topW},${y1} ${-topW},${y1}
        `;
      })
      .style('fill', '#3498db');

    // Add horizontal stripes for texture
    towers.each(function(d) {
      const t = d3.select(this);
      const baseW = x.bandwidth()/2;
      const y0 = innerH;
      const y1 = y(d.performance);
      for (let i = 1; i <= 3; i++) {
        const yPos = y1 + (y0 - y1) * (i / 4);
        const wStrip = baseW * (1 - i * 0.2);
        t.append('line')
          .attr('x1', -wStrip).attr('x2', wStrip)
          .attr('y1', yPos).attr('y2', yPos)
          .style('stroke', '#fff').style('stroke-width', 1);
      }
    });

    // Light glow circle when passing target
    towers.append('circle')
      .attr('cx', 0)
      .attr('cy', d => y(d.performance))
      .attr('r', x.bandwidth()/3)
      .style('fill', 'yellow')
      .style('opacity', d => d.performance >= d.target ? 1 : 0);

    // Target line marker
    towers.append('line')
      .attr('x1', -x.bandwidth()/2).attr('x2', x.bandwidth()/2)
      .attr('y1', d => y(d.target)).attr('y2', d => y(d.target))
      .style('stroke', '#e74c3c').style('stroke-dasharray', '4,2');

    // Competency labels below
    towers.append('text')
      .attr('y', innerH + 20).attr('dy', '.71em')
      .attr('text-anchor', 'middle')
      .text(d => d.competency);

    done();
  }
});
