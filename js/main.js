import { GEO } from "./geo-content.js";
import { mountApp } from "./engine.js";
import { mountExtras } from "./geo-extras.js";
import { mountAccount } from "./account.js";
import { mountStats } from "./stats.js";
import { mountHome } from "./home.js";
import { mountStudy } from "./study.js";
import { prefs } from "./prefs.js";

mountAccount();
const study = mountStudy(GEO);
const ui = mountApp(GEO, study);
mountExtras();
mountStats("geometry");
mountHome(GEO, ui, study);
prefs.sync();
