import $ from "jquery";
import Route from "./route";
import Controls from "./controls";
import { calc3DPositions } from "../utils/panoutils";
import UserInterface from "./userInterface";
import { Vector2, Vector3 } from "three";
// import Config from "../../data/config";

import Marker from "./marker";
import Globus from "./globus";
import LightManager from "./lightManager";

export default class RouteManager {
    public routes: Route[] = [];
    public activeMarker: Marker | null = null;

    // private heightData: Promise<Array<Array<Number>>>;
    private ui: UserInterface;
    private _activeRoute: Route | undefined = undefined;

    constructor(
        private scene: THREE.Scene,
        private container: HTMLElement,
        private globusradius: number,
        private controls: Controls,
        private heightData: Promise<Array<Array<number>>>,
        private globus: Globus,
        private lightManager: LightManager
    ) {
        this.ui = new UserInterface(container, controls, this);
    }

    set toggleClouds(value: boolean) {
        if (this.globus.clouds) {
            this.globus.clouds.visible = value;
        }
    }

    set toggleBorders(value: boolean) {
        this.globus.borders = value;
    }

    set toggleNight(value: boolean) {
        this.globus.setNight(value);
        this.lightManager.setNight(value);
    }

    public playDraw(): boolean {
        return this.activeRoute.drawAnimation();
    }

    public stopDraw(): boolean {
        if (this.activeRoute !== undefined) {
            return this.activeRoute.stopDrawAnimation();
        }
        return false;
    }

    public buildRoute(
        routeData: RouteData,
        phase: number,
        folder: any
    ): Promise<Route> {
        return this.heightData.then((data) => {
            let calculatedRouteData: Poi[] = calc3DPositions(
                routeData.gps,
                data,
                this.globusradius
            );
            if (process.env.NODE_ENV === "development") {
                var folderCustom = folder.addFolder(routeData.meta.name);
                folderCustom.open();
            }
            const route = new Route(
                routeData.meta.name,
                this.scene,
                this.container,
                calculatedRouteData,
                phase,
                this.controls,
                this,
                this.ui,
                folderCustom
            );

            this.routes.push(route);
            this.ui.addRoute(route);

            // Onload other route disable last active marker
            if (this.activeMarker !== null) {
                this.activeMarker.setActive(false);
            }

            if (this.activeRoute === undefined) {
                this.activeRoute = route;
                // play animation
                route.spawn();
                // route.drawAnimation();
            } else {
                route.isVisible = false;
            }

            return route;
        });
    }

    private spawnRoute(route: Route): void {
        route.isVisible = true;
        // route.setActiveMarker(route.marker[route.marker.length - 1]);
        // select last Marker on first route, and first marker on following routes
        // const index = this.routes.length > 1 ? 0 : route.marker.length - 1;
        const poi = route.marker[route.marker.length - 1].poi;
        this.controls
            .moveIntoCenter(poi.lat, poi.lng, 2000, undefined, 650)
            .onStart(() => {
                //@ts-ignore
                this.controls.tweenTarget(new Vector3(0, 0, 0)).start();
            })
            .onComplete(() => {
                // build slider
                // this.ui.createSlider(route.routeData, route);
                this.controls.enabled = true;
            })
            .start();
    }

    get activeRoute() {
        return this._activeRoute;
    }
    set activeRoute(route: Route) {
        this.stopDraw();
        this.deselectMarker();
        this._activeRoute = route;
        this.routes.forEach((r) => {
            if (r !== route) {
                r.isVisible = false;
            }
        });

        this.spawnRoute(route);
    }

    static load(url: string) {
        // load datalist
        return $.getJSON(url, {
            format: "json",
        })
            .done(() => {
                console.log("Route has been loaded");
                // this.buildRoute(data, phase, folder);
            })
            .fail(() => {
                alert("Sorry! An Error occured while loading the route :(");
            });
        // .always(function() {
        // alert( "complete" );
        // });
    }

    public deselectMarker(): void {
        if (this.activeMarker) {
            this.activeMarker.setActive(false);
            this.activeMarker = null;
        }
        if (this.activeRoute) {
            this.activeRoute.activeMarker = null;
        }
        // @ts-ignore
        this.controls.tweenTarget(new Vector3(0, 0, 0)).start();
    }

    public setActiveMarker(route: Route, marker: Marker) {
        if (route !== this.activeRoute) return;

        if (route.activeMarker === marker) {
            // current marker is active => toggle
            marker.setActive(false);
            route.activeMarker = null;
            this.activeMarker = null;
            //@ts-ignore
            this.controls.tweenTarget(new Vector3(0, 0, 0)).start();
            return;
        } else if (this.activeMarker != undefined) {
            // the manager disables ALL active Markers
            // this.routes.forEach((r) => {
            //     if (r.activeMarker != undefined) {
            //         r.activeMarker.setActive(false);
            //         r.activeMarker = null;
            //     }
            // });
            // some other marker is active, turn off then turn new one on
            this.activeMarker.setActive(false);
            marker.setActive(true);
        } else {
            marker.setActive(true);
        }
        this.activeMarker = marker;

        // move the view Up if Portrait Mode
        if (window.innerHeight > window.innerWidth) {
            this.controls
                .moveIntoCenterDown(
                    marker.poi.lat,
                    marker.poi.lng,
                    new Vector2(0, -1)
                )
                .start();
        } else {
            this.controls
                .moveIntoCenter(marker.poi.lat, marker.poi.lng, 1000)
                .start();
        }
    }

    public update(delta: number, camera: THREE.Camera) {
        if (this.activeRoute !== undefined) {
            this.activeRoute.update(delta, camera);
        }
    }
}