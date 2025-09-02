// Typdefinitionen für @stadtmessungsamt-stuttgart/geoline.ol.js
// Minimale, aber präzise Typisierungen ohne Verwendung von "any".

import type Map from 'ol/Map.js';
import type View from 'ol/View.js';
import type BaseLayer from 'ol/layer/Base.js';
import type TileLayer from 'ol/layer/Tile.js';
import type ImageLayer from 'ol/layer/Image.js';
import type VectorLayer from 'ol/layer/Vector.js';
import type Feature from 'ol/Feature.js';
import type Style from 'ol/style/Style.js';
import type { StyleFunction } from 'ol/style/Style.js';
import ImageSource from "ol/source/Image";

export as namespace StmaOpenLayersNS;

// Minimale Hilfstypen, um Options-Objekte ohne any zu erlauben
export type UnknownRecord = Record<string, unknown>;
export type LayerLike = BaseLayer | TileLayer | ImageLayer<ImageSource> | VectorLayer;
export type GeoJSONData = object; // z.B. FeatureCollection/Feature/Geometry laut RFC 7946

export interface CustomParams {
  tileLoadFunction?: (imageTile: unknown, src: string) => void;
  config?: UnknownRecord;
}

export default class StmaOpenLayers {
  constructor(configUrl?: string);

  // Initialisierung und Karte
  initMap(
    epsgCode: number | string,
    mapParams?: UnknownRecord,
    viewParams?: Partial<View> | UnknownRecord,
    customParams?: CustomParams,
    callback?: (map: Map) => void
  ): void;
  getMap(): Map | null;
  getConfig(): UnknownRecord | null;

  // Layer‑Helfer
  addEsriLayer(
    url: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: LayerLike) => void
  ): void;

  addStmaEsriLayer(
    mapservice: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: LayerLike) => void
  ): void;

  addWMTSLayer(
    url: string,
    layerName?: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: TileLayer) => void
  ): void;

  addWMSLayer(
    url: string,
    layerName: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: ImageLayer<ImageSource> | TileLayer) => void
  ): void;

  addStmaWMTSLayer(
    layerName: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: TileLayer) => void
  ): void;

  addStmaWMSLayer(
    layerName: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: ImageLayer<ImageSource> | TileLayer) => void
  ): void;

  addStmaBaseLayer(
    mapname: string,
    layerParams?: UnknownRecord,
    sourceParams?: UnknownRecord,
    callback?: (layer: LayerLike) => void
  ): void;

  addPoints(
    pointCoords: [number, number][],
    imageURL: string,
    callback?: (layer: VectorLayer) => void
  ): void;

  addGeoJSONfromURL(
    url: string,
    zoomTo?: boolean,
    style?: Style | Style[] | StyleFunction,
    callback?: (layer: VectorLayer | false) => void
  ): void;

  addGeoJSON(
    geojson: GeoJSONData,
    zoomTo?: boolean,
    style?: Style | Style[] | StyleFunction,
    callback?: (layer: VectorLayer) => void
  ): void;

  addStmaEsriFeatureLayer(
    mapservice: string,
    layerId: number,
    styleFunction?: (feature: Feature) => Style | Style[] | undefined,
    callback?: (layer: VectorLayer) => void
  ): void;

  // Overlays
  addOverlayForLayer(
    layer: LayerLike,
    overlayFunction?: (feature: Feature) => string | HTMLElement
  ): void;
}

// Veralteter Alias, den die Bibliothek ebenfalls exportiert
export const stma_openlayers: typeof StmaOpenLayers;
