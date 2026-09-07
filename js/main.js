import { GEO } from "./geo-content.js";
import { mountApp } from "./engine.js";
import { mountExtras } from "./geo-extras.js";
import { mountAccount } from "./account.js";
import { mountStats } from "./stats.js";
import { mountHome } from "./home.js";
import { prefs } from "./prefs.js";

mountAccount();
const ui = mountApp(GEO);
mountExtras();
mountStats("geometry");
mountHome(GEO, ui);
prefs.sync();
