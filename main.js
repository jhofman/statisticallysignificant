// The svg
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

var data, geo_data;

// Map and projection
var center_of_map = [-100, 40];
var projection = d3.geoMercator()
    .center(center_of_map)                // GPS of location to zoom on
    .scale(550)                       // This is like the zoom
    .translate([width / 2, height / 4])

var angle = 0;
var left_top, left_bottom, right_top, right_bottom;
var hit_stat_sig = false;

var usa_map, circles, divider;
var left_average, left_bar, right_average, right_bar;

var x_scale, x_axis, y_scale, y_axis;

d3.queue()
    .defer(d3.json, "https://raw.githubusercontent.com/shawnbot/topogram/master/data/us-states.geojson")  // USA shape
    .defer(d3.csv, "initial_points.csv") // Position of circles
    .await(ready);

function ready(error, fetched_geo_data, fetched_data) {

    // hack to keep things global for easy debugging
    geo_data = fetched_geo_data;
    data = fetched_data;
    //data = d3.shuffle(data);

    // Draw the map
    usa_map = svg.append("g")
        .selectAll("path")
        .data(geo_data.features)
        .enter()
        .append("path")
        .attr("id", "usa-map")
        .attr("fill", "none")
        .attr("d", d3.geoPath()
            .projection(projection)
        )
        .style("stroke", "#b8b8b8")
        .style("opacity", .7)

    // create x and y scales, show axes and
    setup_plot();

    // Add circles:
    circles = svg
        .selectAll("myCircles")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return projection([+d.long, +d.lat])[0] })
        .attr("cy", function (d) { return projection([+d.long, +d.lat])[1] })
        .attr("r", function (d) { return 2 })
        .style("fill", function (d) { if (is_left_of_line(+d.long, +d.lat)) return "purple"; else return "green"; })
        .attr("stroke", function (d) { if (d.n > 2000) { return "black" } else { return "none" } })
        .attr("stroke-width", 1)
        .attr("fill-opacity", 0)
        .attr("class", "not-sampled")

    circles
        .transition()
        .delay(function (d, i) { return 1000 * i / data.length; })
        .duration(1)
        .attr("fill-opacity", 0.1)
    //.attr("class", function (d) { if (is_left_of_line(+d.long, +d.lat)) return "purple-circle"; else return "green-circle"; })

    // add divider line
    var divider = svg.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', 0)
        .attr('stroke', 'black')
        .attr('stroke-width', '5px')

    update_split(divider, projection(center_of_map)[0], 200, 0, circles);

    divider
        .transition()
        .duration(1000)
        .attr('y1', -200)
        .attr('y2', 200)
    //.on("end", play_animation(svg, data, circles, x_scale, y_scale))

    // when the input range changes update the angle 
    d3.select("#nAngle").on("input", function () {
        angle = +this.value;
        update_split(divider, projection(center_of_map)[0], 200, +this.value, circles);
    });

    circles
        .style("fill", function (d) { if (is_left_of_line(+d.long, +d.lat)) return "purple"; else return "green"; });

    // start on start button click
    $('#start-button').click(function () {
        $('#instructions').slideUp();
        $('#started').fadeIn();
        play_animation(svg, data, circles, x_scale, y_scale);
    });
}

function setup_plot() {
    /* scale and axis for x */
    // Create scale
    x_scale = d3.scalePoint()
        .domain(['', 'Purple side', 'Green side', ' '])
        .range([100, width - 100]);
    // Add scales to axis
    x_axis = d3.axisBottom()
        .scale(x_scale);

    //Append group and insert axis
    svg
        .append("g")
        .attr("transform", "translate(0," + 0.9 * height + ")")
        .attr("class", "x-axis")
        .call(x_axis);

    /* scale and axis for y */
    y_scale = d3.scaleLinear()
        .domain([65, 70])
        //.range([height/4,0]);
        .range([0.9 * height, 0.9 * height - height / 4])

    // Add scales to axis
    y_axis = d3.axisLeft()
        .scale(y_scale);

    //Append group and insert axis
    svg
        .append("g")
        //.attr("transform", "translate(100," + (0.9*height - height/4) + ")")
        .attr("transform", "translate(100,0)")
        .attr("class", "y-axis")
        .call(y_axis);

    // Add y axis label
    svg.append("text")
        .attr("class", "y-axis-label")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", 65)
        .attr("x", -(0.9 * height - height / 4))
        .text("Average height (inches)")
}

// update the dividing line
function update_split(divider, x, y, nAngle, circles) {

    // adjust the text on the range slider
    //d3.select("#nAngle-value").text(nAngle);
    d3.select("#nAngle").property("value", nAngle);

    // rotate the line
    divider
        .attr("transform", "translate(" + x + "," + y + ") rotate(" + nAngle + ")");

    circles
        .style("fill", function (d) {
            if (is_left_of_line(+d.long, +d.lat)) return "purple"; else return "green";
        })
}

function play_animation(svg, data, circles, x_scale, y_scale) {
    // get averages for left and Green sides
    var avg_height_by_split = d3
        .nest()
        .key(function (d) { return is_left_of_line(+d.long, +d.lat); })
        .rollup(function (v) { return d3.mean(v, v => +v.height); })
        .entries(data)
        .map(function (d) { return d.value; })

    // compute the running mean in each group
    // store in the array moving_target,
    // which has the final location that each point should go to
    var running_sum = [0, 0];
    var running_count = [0, 0];
    var moving_target = [];
    var side_of_line = [];
    var diff_means = [];
    for (i = 0; i < data.length; i++) {
        var side = +(is_left_of_line(+data[i].long, +data[i].lat));
        running_sum[side] += +data[i].height;
        running_count[side] += 1;
        moving_target.push(running_sum[side] / running_count[side]);

        diff_means.push(running_sum[0] / running_count[0] - running_sum[1] / running_count[1]);

        if (!side)
            side_of_line.push('Purple side')
        else
            side_of_line.push('Green side')
    }

    // compute the running standard error in each group
    // store in the array moving_se,
    // which has the error bar size for each point
    var running_squared_diff = [0, 0];
    var running_count = [0, 0];
    var moving_se = [];
    var t_stat = [];
    for (i = 0; i < data.length; i++) {
        var side = +(is_left_of_line(+data[i].long, +data[i].lat));
        running_squared_diff[side] += Math.pow(+data[i].height - moving_target[i], 2);
        running_count[side] += 1;
        var sd = Math.sqrt(running_squared_diff[side] / running_count[side]);
        moving_se.push(sd / Math.sqrt(running_count[side]));

        var var_left = (running_squared_diff[0] / running_count[0]) / (running_count[0]);
        var var_right = (running_squared_diff[1] / running_count[1]) / (running_count[1]);

        var sd_pooled = Math.sqrt((running_count[0] * var_left + running_count[1] * var_right) / i);
        t_stat.push(diff_means[i] / sd_pooled);
    }

    // animate points
    circles
        .transition()
        .delay(function (d, i) { return 100 * i; })
        .duration(0)
        .attr("fill-opacity", 1)
        .attr("r", function (d) { return 3; })
        .attr("class", "being-sampled")
        .transition()
        //.delay(function(d,i){ return 10*i; }) 
        .ease(d3.easeLinear)
        .duration(100)
        .attr("cx", function (d) { if (is_left_of_line(+d.long, +d.lat)) return x_scale('Purple side'); else return x_scale('Green side'); })
        .attr("cy", function (d, i) { return y_scale(moving_target[i]) })
        .transition()
        //.delay(function(d,i){ return 10*i; })
        .duration(10)
        .attr("fill-opacity", function (d, i) { if (i == data.length) return 1; else return 0; })
        .attr("class", "sampled")


    var point_ndx = 0;

    left_average = svg
        .append("circle")
        .attr("r", 3)
        .attr("id", "left-average")
        .attr("fill", "purple")
        .attr("stroke-width", 1)
        .attr("fill-opacity", 0)

    right_average = svg
        .append("circle")
        .attr("id", "right-average")
        .attr("r", 3)
        .attr("fill", "green")
        .attr("stroke-width", 1)
        .attr("fill-opacity", 0)

    left_bar = svg
        .append("line")
        .attr("id", "left-bar")
        .attr('x1', x_scale('Purple side'))
        .attr('x2', x_scale('Purple side'))
        .attr('y1', y_scale(65))
        .attr('y2', y_scale(70))
        .attr("stroke", "purple")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

    right_bar = svg
        .append("line")
        .attr("id", "right-average")
        .attr('x1', x_scale('Green side'))
        .attr('x2', x_scale('Green side'))
        .attr('y1', y_scale(65))
        .attr('y2', y_scale(70))
        .attr("stroke", "green")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

    function move_average() {
        if (point_ndx >= moving_target.length)
            return;
        else {
            var side = side_of_line[point_ndx];

            var this_average, this_bar;
            if (side == 'Purple side') {
                this_average = left_average;
                this_bar = left_bar;
            } else {
                this_average = right_average;
                this_bar = right_bar;
            }

            left_top = +left_bar.attr('y1')
            left_bottom = +left_bar.attr('y2')
            right_top = +right_bar.attr('y1')
            right_bottom = +right_bar.attr('y2')

            if (!hit_stat_sig && point_ndx > 100 && Math.abs(t_stat[point_ndx]) > 1.96) {
                d3
                    .select('#status')
                    .html('<font color=red>We found a statistically significant difference after sampling ' + (point_ndx + 1) + ' people!</font>');
                hit_stat_sig = true;

                d3
                    .selectAll(".being-sampled")
                    .attr("fill-opacity", 0)

                // stop all transitions
                d3
                    .selectAll('*')
                    .transition();

                show_explainer();

                return;
            }

            this_average
                .transition()
                .duration(100)
                .attr("cx", x_scale(side))
                .attr("cy", y_scale(moving_target[point_ndx]))
                .on("end", move_average)

            this_bar
                .transition()
                .duration(100)
                .attr("opacity", 1)
                .attr('y1', y_scale(moving_target[point_ndx] + moving_se[point_ndx]))
                .attr('y2', y_scale(moving_target[point_ndx] - moving_se[point_ndx]))

            d3.select('#samples-taken').html(point_ndx + 1);
            point_ndx = point_ndx + 1;
        }
    }


    left_average
        .transition()
        .duration(100)
        .attr("cx", x_scale('Purple side'))
        .attr("cy", y_scale(0))
        .attr("fill-opacity", 1)
        .on("end", move_average);

    right_average
        .transition()
        .duration(100)
        .attr("cx", x_scale('Green side'))
        .attr("cy", y_scale(0))
        .attr("fill-opacity", 1)
        .on("end", move_average);


}


// check which side of line
// works in original lat / long space
// but this gets messed up by projection
// so use version below instead
function is_left_of_line_lat_lon(x, y) {
    return (y - 38) - Math.tan((90 - angle) * Math.PI / 180) * (x + 100) > 0;
}

// check which side of line
// in projected map space
function is_left_of_line(x, y) {
    var p = projection([x, y]);
    x = p[0];
    y = p[1];

    var x0 = projection(center_of_map)[0]
    var y0 = 200;

    var side = (y - y0) - Math.tan((angle - 90) * Math.PI / 180) * (x - x0) > 0;

    if (angle >= 0)
        return !side;
    else
        return side;
}

function show_explainer() {
    $('#explainer').fadeIn(function() {
        $('#show-all-button').fadeIn().click(function() {
            $(this).fadeOut();
            rescale_and_show_sampled_points();
        });
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
    });
}

function rescale_and_show_sampled_points() {
    var new_y_scale = y_scale.domain([50, 90])
    var new_y_axis = d3.axisLeft().scale(new_y_scale)

    $('.y-axis-label').fadeOut(function () {
        $(this).html('Height (inches)').fadeIn();
    });

    d3
        .select('.y-axis')
        .transition()
        .duration(2000)
        .call(new_y_axis)
        .on("end", show_sampled_points)

}

function show_sampled_points() {
    d3
        .selectAll('.sampled')
        .attr("cx", function (d) { if (is_left_of_line(+d.long, +d.lat)) return jitter_x(x_scale('Purple side')); else return jitter_x(x_scale('Green side')); })
        .attr("cy", function (d) { return jitter_y(y_scale(d.height)); })
        .transition()
        .duration(1000)
        .attr("fill-opacity", 0.25)
        .on("end", function() {
            $('#rest-of-explainer').slideDown(function() {
                $("html, body").animate({ scrollTop: $(document).height() }, "slow");
            });
        })

    left_average
        .attr("stroke", "black")
        .attr("fill", "black")
    left_bar
        .attr("stroke", "black")
        .attr("fill", "black")
        
    right_average
        .attr("stroke", "black")
        .attr("fill", "black")

    right_bar
        .attr("stroke", "black")
        .attr("fill", "black")
}

function jitter_y(y) {
    return y + height / 20 * (Math.random() - 0.5);
}

function jitter_x(x) {
    return x + width / 10 * (Math.random() - 0.5);
}