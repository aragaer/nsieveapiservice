const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const ATTRIBUTES = {
    CHARISMA:       0,
    INTELLIGENCE:   1,
    MEMORY:         2,
    PERCEPTION:     3,
    WILLPOWER:      4,
};

const ROMAN = ["none","I","II","III","IV","V"];

function sp_for_level(level, rank) {
    return rank*250*Math.pow(2, 2.5*(level-1))
}

function EveSkill() { }

EveSkill.prototype = {
    classDescription: "EVE Online character skill",
    classID:          Components.ID("{07f1eb08-b7a7-4d73-bb41-e5922cca94c1}"),
    contractID:       "@aragaer.com/eve-skill;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIEveSkill]),
    getSpForLevel: function (level) {
        return sp_for_level(level, this.rank);
    },
};
var components = [EveSkill];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}
