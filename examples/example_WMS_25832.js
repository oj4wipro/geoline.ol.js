//import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js";
import StmaOpenLayers from "../src/geoline.ol";
import "../src/geoline.ol.css";

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {target: "the-map"},
    {zoom: 6},
    {},
    function (map) {
        console.log("initMap wurde ausgeführt");
    }
);

mymap.addStmaWMSLayer(
    "Base:A62_Luftbild_2009_EPSG25832",
    {},
    {},
    (layer) => console.log("STMA WMS OK", layer)
);
