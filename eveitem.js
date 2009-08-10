const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const PreloadedTypes = {};
const PreloadedGroups = {};
const PreloadedCategories = {};

var EveDBService;
const ItemFactory = {
    _getPreloaded:      function (storage, construct) {
        return function (id) {
            if (!storage['itm' + id])
                storage['itm' + id] = construct(id);
            return storage['itm' + id];
        }
    },

    getItemGroupByType: function (type) {
        return this.getItemGroup(EveDBService.getItemGroupByType(type));
    },

    getItemCategoryByGroup: function (group) {
        return this.getItemCategory(EveDBService.getItemCategoryByGroup(group));
    },


    makeCategory:       function (id) {
        return new eveitemcategory(id);
    },

    makeGroup:          function (id) {
        return new eveitemgroup(id);
    },

    makeType:           function (id) {
        var group   = EveDBService.getItemGroupByType(id);
        var cat     = EveDBService.getItemCategoryByGroup(group);

        switch (cat) {
        default:
            break;
        };

        switch (group) {
        case Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER:
            return new controltowertype(id);
        default:
            break;
        };

        return new eveitemtype(id);
    },
    makeItem:           function (id, location, container, typeID, quantity, flag, singleton) {
        var group   = EveDBService.getItemGroupByType(typeID);
        var cat     = EveDBService.getItemCategoryByGroup(group);
        var constructor = eveitem;
        
        switch (group) {
        case Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER:
            constructor = controltower;
            break;
        default:
            break;
        };
        
        return new constructor(id, location, container, typeID,
                quantity, flag, singleton);
    }
};

ItemFactory.getItemCategory = ItemFactory._getPreloaded(PreloadedCategories, ItemFactory.makeCategory);
ItemFactory.getItemGroup = ItemFactory._getPreloaded(PreloadedGroups, ItemFactory.makeGroup);
ItemFactory.getItemType = ItemFactory._getPreloaded(PreloadedTypes, ItemFactory.makeType);

function extend(to, from) {
    for (i in from) {
        var g = from.__lookupGetter__(i), s = from.__lookupSetter__(i);
        if (g || s) {
            if (g)
                to.__defineGetter__(i, g);
            if (s)
                to.__defineSetter__(i, s);
        } else
            to[i] = from[i];
    }
}

function eveitemcategory(catid) {
    this._id = catid;
    this._name = EveDBService.getItemCategoryNameByID(catid);
}

eveitemcategory.prototype = {
    classDescription:   "EVE item category",
    classID:            Components.ID("{ef3555fb-be5d-43c9-83ab-d3e8d5432f43}"),
    contractID:         "@aragaer/eve/item-category;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemCategory]),

    get id()            this._id,
    get name()          this._name,
};

function eveitemgroup(groupid) {
    this._id = groupid;
    this._name = EveDBService.getItemGroupNameByID(groupid);
    this._category = ItemFactory.getItemCategoryByGroup(groupid);
}

eveitemgroup.prototype = {
    classDescription:   "EVE item group",
    classID:            Components.ID("{5e922507-10b0-4fee-b8df-9f95df29a28a}"),
    contractID:         "@aragaer/eve/item-group;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemGroup]),

    get id()            this._id,
    get name()          this._name,
    get category()      this._category,
};

function eveitemtype(typeid) {
    if (!typeid)
        return;
    this._id = typeid;
    this._name = EveDBService.getItemTypeNameByID(typeid);
    this._group = ItemFactory.getItemGroupByType(typeid);
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
    if (!id)
        return;
    this._id = id;
    this._location = location;
    this._container = container;
    this._type = ItemFactory.getItemType(type);
    this._quantity = quantity;
    this._flag = flag;
    this._singleton = singleton;
    this._childs = null;
    this._name = EveDBService.getItemName(id);
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

    get name()      this._name,
    set name(name)  {
        this._name = name;
        EveDBService.setItemName(this._id, name,
            this._type._group._category._id,
            this._type._group._id,
            this._type._id);
    },

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

function fueltype(itemtype, purpose, towertype, usage) {
    this._type = itemtype;
    this._purpose = +purpose;
    this._towertype = towertype;
    this._usage = +usage;
}
fueltype.prototype = {
    classDescriptopn:   "EVE Control tower fuel",
    classID:            Components.ID("{1a99a0bf-3f0f-4edc-a79d-404c0ce7f5c0}"),
    contractID:         "@aragaer/eve/control-tower-fuel-type;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveFuelType]),
    get type()          this._type,
    get purpose()       this._purpose,
    get towertype()     this._towertype,
    get consumption()   this._usage,
    toString:           function () {
        return this._type.name;
    }
};

function posfuel(type, count, tower) {
    this._type = type;
    this._count = count;
    this._tower = tower;
}
posfuel.prototype = {
    classDescriptopn:   "EVE Control tower fuel item",
    classID:            Components.ID("{fecf0883-57fb-4974-a169-7a9be88cc6a7}"),
    contractID:         "@aragaer/eve/control-tower-fuel;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveFuel]),
    get type()      this._type,
    get count()     this._count,
    get realConsumption() {
        var factor = 1;
        switch(this._type.purpose) {
        case Ci.nsEveFuelPurpose.PURPOSE_POWER:
            factor = this._tower.powerUsage/this._tower.type.powerGrid;
            break;
        case Ci.nsEveFuelPurpose.PURPOSE_CPU:
            factor = this._tower.CPUUsage/this._tower.type.CPU;
            break;
        case Ci.nsEveFuelPurpose.PURPOSE_ONLINE:
        default:
            factor = 1;
            break;
        }
        return Math.round(this._type.consumption*factor);
    },
    toString:       function () {
        return this._type.type.name;
    },
    hoursLeft:      function () {
        var c = this.realConsumption;
        return c
            ? Math.floor(this._count/c)
            : -1;
    },
};

function controltower() {
    eveitem.apply(this, arguments);
    var res = EveDBService.getGridAndCPUUsage(this._id).wrappedJSObject;
    this._powerUsage = res.grid;
    this._CPUUsage = res.cpu;
    dump(this._name + " uses " + res.grid + " grid\n");
}
controltower.prototype = new eveitem();
extend(controltower.prototype, {
    classDescription:   "EVE Control Tower instance",
    classID:            Components.ID("{cfa1e940-1ca1-42f4-98b5-109cdc438641}"),
    contractID:         "@aragaer/eve/control-tower;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItem, Ci.nsIEveControlTower]),
    get powerUsage()    this._powerUsage,
    get CPUUsage()      this._CPUUsage,
    getFuel:            function (out) {
        var fuel = [];
        var reqs = this._type.getFuelRequirements({}).
                concat(this._type.getFuelForSystem(this._location, {}));

        for each (i in this._childs)
            fuel['f'+i.type.id] = i.quantity;

        var res = reqs.map(function (r) {
            return new posfuel(r, fuel['f'+r._type.id] || 0, this);
        });
        out.value = res.length;
        return res;
    },
});

function controltowertype() {
    eveitemtype.apply(this, arguments);
    var res = EveDBService.getGridAndCPUForTower(this._id).wrappedJSObject;
    this._powerGrid = res.grid;
    this._CPU = res.cpu;
    dump(this._name + " produces " + this._powerGrid + " grid and " + this._CPU+" CPU\n");
}
controltowertype.prototype = new eveitemtype();
extend(controltowertype.prototype, {
    classDescription:   "EVE Control Tower",
    classID:            Components.ID("{89a9aeb3-9f44-427d-bc4c-274dbef8d93f}"),
    contractID:         "@aragaer/eve/control-tower-type;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemType, Ci.nsIEveControlTowerType]),


    _getFuelFromWrappedObj:     function(obj) {
            i = obj.wrappedJSObject;
            return new fueltype(
                ItemFactory.getItemType(i.typeid),
                i.purpose,
                this,
                i.usage
            );
    },

    getFuelRequirements:function (out) {
        var res = EveDBService.getControlTowerFuelRequirements(this._id, out);
        return res.map(this._getFuelFromWrappedObj);
    },
    getFuelForSystem:function (sys, out) {
        var res = EveDBService.getControlTowerFuelForSystem(this._id, sys, out);
        return res.map(this._getFuelFromWrappedObj);
    },

    get powerGrid()     this._powerGrid,
    get CPU()           this._CPU,
});

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
    getItemGroupByType:         ItemFactory.getItemGroupByType,
    getItemCategoryByGroup:     ItemFactory.getItemCategoryByGroup,

/* Item Builder */
    createItem:         ItemFactory.makeItem,
};

var components = [eveitemcategory, eveitemgroup, eveitemtype, eveitem, itembuilder,
        controltower, controltowertype, fueltype, posfuel];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

