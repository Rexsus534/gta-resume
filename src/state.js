export const Mode = {
  ON_FOOT: 'ON FOOT',
  DRIVING: 'DRIVING',
};

export const state = {
  mode: Mode.ON_FOOT,
  /** The Vehicle the player currently occupies, or null. */
  activeVehicle: null,
  /** Vehicle within reach of an F press while on foot, or null. */
  nearbyVehicle: null,
  /** Speed of whatever the player is controlling, in m/s. */
  speed: 0,

  /** The coin monuments, populated by main.js from entities/coins.js. */
  collectibles: [],
  /** True while a resume panel is up; the player stops taking input. */
  panelOpen: false,
};
