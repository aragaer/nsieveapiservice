const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var EveDBService;
const PreloadedItems = {};

function eveitemtype(typeid) {
    this._id = typeid;
    var data = EveDBService.getItemTypeInfo(typeid);

    this._name = data.name;
    this._group = data.group;
}

eveitemtype.prototype = {
    classDescription:   "EVE item type",
    classID:            Components.ID("{fb6bfcfe-5f16-4dc1-a78d-de5e4b766a26}"),
    contractID:         "@aragaer/eve/item-type;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemType]),

    get id()            this._id,
    get name()          this._name,
    get group()         this._group,
};

function eveitem(id, location, container, type, quantity, flag, singleton) {
    this._id = id;
    this._location = location;
    this._container = container;
    this._type = type;
    this._quantity = quantity;
    this._flag = flag;
    this._singleton = singleton;
    this._childs = null;
}

eveitem.prototype = {
    classDescription:   "EVE Item",
    classID:            Components.ID("{658ce840-ac50-4429-97bd-a68e9327b884}"),
    contractID:         "@aragaer/eve/item;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItem]),

    toString:           function () {
        return this.type.name;
    },
    locationString:     function () {
        return EveDBService.locationToString(this._location);
    },
    containerString:    function () {
        return this._container
            ? this._container.toString()
            : '';
    },

    get id()        this._id,
    get location()  this._location,
    get container() this._container,
    get type()      this._type,
    get quantity()  this._quantity,
    get flag()      this._flag,
    get singleton() this._singleton,

    isContainer:        function () {
        return this._childs ? true : false;
    },

    getItemsInside:     function (out) {
        if (!this._childs)
            return null;
        var result = [i for each (i in this._childs)];
        out.value = result.length;
        return result;
    },

    addItem:            function (itm) {
        if (!this._childs)
            this._childs = [];
        if (!this._childs['itm' + itm.id])
            this._childs['itm' + itm.id] = itm;
    },

    removeItem:         function (itm) {
        this._childs.delete('itm' + itm.id);
    },
};

function itembuilder() { }

itembuilder.prototype = {
    classDescription:   "EVE Item Builder",
    classID:            Components.ID("{e5dc59a4-217e-46da-8c9f-d6de36df2d3f}"),
    contractID:         "@aragaer/eve/item-builder;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemBuilder]),
    _xpcom_factory:     {
        createInstance:     function (outer, iid) {
            if (outer)
                throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (!EveDBService)
                EveDBService = Cc["@aragaer/eve/db;1"].
                        getService(Ci.nsIEveDBService);
            return (new itembuilder()).QueryInterface(iid);
        },
    },
    _xpcom_categories:  [{
        category: "profile-do-change",
        service: true
    }],

/* Item Builder */
    createItemType:    function (typeID) {
        if (!PreloadedItems['itm'+typeID])
            PreloadedItems['itm'+typeID] = new eveitemtype(typeID);
        return PreloadedItems['itm'+typeID];
    },

    createItem:     function (id, location, container, typeID, quantity, flag, singleton) {
        var type = this.createItemType(typeID);
        return new eveitem(id, location, container, type,
                quantity, flag, singleton);
    }
}

var components = [eveitemtype, eveitem, itembuilder];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

