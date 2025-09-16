import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js/src/geoline.ol.js";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/src/geoline.ol.css";

/**

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {target: "the-map"},
    {
        center: [513422, 5403039], // somewhere inside Stuttgart in EPSG:25832
        zoom: 14
    },
    {},
    function (map) {
        console.log("initMap wurde ausgeführt");
    }
);

mymap.addStmaWMSLayer(
    "Base:A62_Luftbild_2009_EPSG25832",
    {},
    {
        TILED: true,   // make sure we request cached tiles
        serverType: "geoserver",
        crossOrigin: "anonymous",
        params: {
            VERSION: "1.3.0",
            FORMAT: "image/png",
            TRANSPARENT: true,
            STYLES: ""
        }
    },
    (layer) => console.log("STMA WMS OK", layer)
);
/**/

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {
        target: "the-map"
    },
    {
        center: [513422, 5403039], // somewhere inside Stuttgart in EPSG:25832
        zoom: 14
    }
);

mymap.addStmaWMSLayer(
    "Base:A62_Luftbild_2009_EPSG25832",
    {},
    {
        TILED: true,   // make sure we request cached tiles
        serverType: "geoserver",
        crossOrigin: "anonymous",
        params: {
            VERSION: "1.3.0",
            FORMAT: "image/png",
            TRANSPARENT: true,
            STYLES: ""
        }
    },
    (layer) => console.log("STMA WMS OK", layer)
);
