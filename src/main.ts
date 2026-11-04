import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

const mountTarget = document.getElementById("app");

if (!mountTarget) {
  throw new Error("The #app mount target is missing from index.html");
}

mount(App, { target: mountTarget });
