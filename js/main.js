import { GEO } from "./geo-content.js";
import { mountApp } from "./engine.js";
import { mountExtras } from "./geo-extras.js";
import { mountAccount } from "./account.js";
import { mountStats } from "./stats.js";

mountAccount();
mountApp(GEO);
mountExtras();
mountStats("geometry");
