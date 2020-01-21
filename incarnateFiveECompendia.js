Hooks.on("ready", () =>{
	CONFIG.incarnate.conversion.abilityListLower = {
		str:"strength",
		dex:"dexterity",
		con:"constitution",
		"int":"intelligence",
		wis:"wisdom",
		cha:"charisma"
	};
	CONFIG.incarnate.conversion.abilityActivation = {
		"action": "action",
		"bonus": "bonus action",
		"reaction": "reaction",
		"minute": "minute",
		"hour": "hour",
		"day": "day",
		"special": "year",
		"legendary": "legendary",
		"lair": "lair"
	};
	CONFIG.incarnate.conversion.damageTypes = {
		"acid": "acid",
		"bludgeoning": "bludgeoning",
		"cold": "cold",
		"fire": "fire",
		"force": "force",
		"lightning": "lightning",
		"necrotic": "necrotic",
		"piercing": "piercing",
		"poison": "poison",
		"psychic": "psychic",
		"radiant": "radiant",
		"slashing": "slashing",
		"thunder": "thunder"
	}
	CONFIG.incarnate.conversion.abilityDuration = {
		"inst": "instantaneous",
		"turn": "turn",
		"round": "round",
		"minute": "minute",
		"hour": "hour",
		"day": "day",
		"month": "month",
		"year": "year",
		"perm": "permanent",
		"spec": "special"
	}
	CONFIG.incarnate.conversion.spellScalingModes = {
		"cantrip": "cantrip",
		"level": "spell slot"
	}
});
Hooks.on("incRegionsSetup", (tempRegions,target) => {
	//const result = IncarnateFiveECompendia.setupRegions(tempRegions, target);
	return true;
});
class IncarnateFiveECompendia{
	static async setupRegions(tempRegions, target){
		if (tempRegions === undefined) tempRegions = IncarnateRegions.clearRegions();
		var data = tempRegions;
		var filteredBackgrounds, filteredClasses, filteredRaces;
		const rawBackgrounds = await IncarnateReference.incarnatePackFind("incarnateFiveECompendia.incarnateBackground").getContent()
		filteredBackgrounds = rawBackgrounds.filter(background => background.data.type === "class");
		filteredBackgrounds.forEach(background => {
			data.backgrounds.push({
				"name":background.data.name,
				"_id":background.data._id,
				"pack":"incarnateFiveECompendia.incarnateBackground",
				"priority":1
			});
		});
		const rawClasses = await IncarnateReference.incarnatePackFind("incarnateFiveECompendia.incarnateClass").getContent()
		filteredClasses = rawClasses.filter(classs => classs.data.type === "class" && classs.data.data.subclass.value === "");
		filteredClasses.forEach(classs => {
			var archetypes = [];
			const choice = classs.data.flags.choice.filter(choice => choice.name ==="Archetype");
			choice[0].choices.forEach(subChoice =>{
				archetypes.push({
					"name":subChoice.name,
					"_id":subChoice._id,
					"pack":subChoice.pack,
					"priority":1
				});
			});
			data.classes.push({
				"name":classs.data.name,
				"_id":classs.data._id,
				"pack":"incarnateFiveECompendia.incarnateClass",
				"priority":1,
				"archetypes":archetypes
			});
		});
		const rawRaces = await IncarnateReference.incarnatePackFind("incarnateFiveECompendia.incarnateRaces").getContent()
		filteredRaces = rawRaces.filter(race => race.data.type === "class" && race.data.data.subclass.value === "");
		filteredRaces.forEach(race => {
			var subRaces = [];
			const choice = race.data.flags.choice.filter(choice => choice.name ==="Subrace");
			choice[0].choices.forEach(subChoice =>{
				subRaces.push({
					"name":subChoice.name,
					"_id":subChoice._id,
					"pack":subChoice.pack,
					"priority":1
				});
			});
			data.races.push({
				"name":race.data.name,
				"_id":race.data._id,
				"pack":"incarnateFiveECompendia.incarnateRaces",
				"priority":1,
				"archetypes":subRaces
			});
		})
		if (target.type === "gameSettings"){
			const splitPath = target.path.split(".");
			game.settings.set(splitPath[0],splitPath[1],data);
		}else if (target.type === "folder"){
			var targetFolder = game.folders.get(target.path);
			var flags = JSON.parse(JSON.stringify(targetFolder.data.flags));
			flags.incRegions = data;
			targetFolder.update({flags:flags});
		}
	}
}
class IncarnateImportFromUGF{
	static getData(){
		var ugf = new XMLHttpRequest();
		ugf.onreadystatechange = function(){
			if (this.readyState == 4 && this.status == 200){
				return(this.responseXML);
			}
		};
		ugf.open("GET","modules/incarnateFiveECompendia/Incarnate-System.xml",true);
		ugf.send();
	}
	static importAll(){
		var ugf = new XMLHttpRequest();
		ugf.onreadystatechange = async function(){
			if (this.readyState == 4 && this.status == 200){
				const ugfData = this.responseXML;
				await IncarnateImportFromUGF.importBackground(ugfData);
				await IncarnateImportFromUGF.importSpell(ugfData);
			}
		};
		ugf.open("GET","modules/incarnateFiveECompendia/Incarnate-System.xml",true);
		ugf.send();
	}
	// Background Importing
	static async importBackground(ugf){
		const oldPack = IncarnateReference.incarnatePackFind("world.backgroundincarnate");
		if (oldPack !== undefined){
			await oldPack.delete();
			await IncarnateReference.incarnateDelay(200);
		}
		const newPack = await Compendium.create({entity:"Item",label:"Background (Incarnate)"});
		console.log(newPack,ugf);
		const backgrounds = ugf.getElementsByTagName("backgroundChapter")[0].getElementsByTagName("background");
		console.time("backgrounds");
		[].forEach.call(backgrounds, async background =>{
			const backData = IncarnateImportFromUGF.assembleBackground(background,ugf);
			await newPack.createEntity(backData);
			const backFeature = IncarnateImportFromUGF.assembleBackgroundFeature(background,ugf);
			await newPack.createEntity(backFeature);
		});
		console.timeEnd("backgrounds");
		return true;
	}
	/* Takes background node*/
	static assembleBackground(background,ugf){
		const name = background.getElementsByTagName("backgroundName")[0].innerHTML;
		const originId = background.getAttribute("FID");
		var official = "fal";
		var officialTag = background.getElementsByTagName("officialContent")[0];
		if (officialTag !== undefined){
			official = IncarnateConversions.official(official.innerHTML);
		}
		var flags = {
			incarnateWorldBuilding:{
				all:{
					children:[],
					lore:"",
					official:official,
					origin:{
						level:0,
						name:name,
						pack:"world.backgroundsincarnate",
						type:"class",
						_id:originId
					},
					parents:[]
				}
			},
			incarnateFiveEMod:{
				all:{
					family:"background"
				},
				clas:{
					abilityPriority:{
						stat1:"",
						stat2:"",
						stat3:"",
						stat4:"",
						stat5:"",
						stat6:""
					},
					choice:[],
					darkvision:0,
					languages:{
						value:[]
					},
					skills:{
						num:2,
						choice:{value:[]},
						default:{value:[]}
					},
					suggestedCharacteristics:{
						personality:"",
						ideal:"",
						bond:"",
						flaw:""
					},
					tools:{value:[]},
					type:"background"
				}
			}
		};
		var description = background.getElementsByTagName("backgroundDescription")[0].innerHTML;
		var tools = background.getElementsByTagName("backgroundToolProficiencies")[0];
		if (tools !== undefined){
			var tool = tools.getElementsByTagName("crossReference");
			[].forEach.call(tool, t =>{
				flags.incarnateFiveEMod.clas.tools.value.push(IncarnateConversions.toolAll(t.innerHTML));
			});
			description += '<p><strong>Tools:</strong> ' + IncarnateRichText.convertSimple(tools.getElementsByTagName("description")[0].innerHTML) + "</p>";
		}
		var skills = background.getElementsByTagName("backgroundSkillProficiencies")[0];
		if (skills !== undefined){
			var skill = skills.getElementsByTagName("crossReference");
			[].forEach.call(skill, t =>{
				var key = IncarnateConversions.skill(t.innerHTML);
				flags.incarnateFiveEMod.clas.skills.choice.value.push(key);
				flags.incarnateFiveEMod.clas.skills.default.value.push(key);
			});
			description += '<p><strong>Skills:</strong> ' + IncarnateRichText.convertSimple(skills.getElementsByTagName("description")[0].innerHTML) + "</p>";
		}
		var languages = background.getElementsByTagName("backgroundLanguages")[0];
		if (languages !== undefined){
			var language = languages.getElementsByTagName("backgroundLanguage");
			var languageArray = [];
			[].forEach.call(language, t =>{
				var key = IncarnateConversions.language(t.innerHTML);
				flags.incarnateFiveEMod.clas.languages.value.push(key);
				languageArray.push(t.innerHTML);
			});
			description += '<p><strong>Languages:</strong> ' + languageArray.join(', ') + "</p>";
		}
		var equipment = background.getElementsByTagName("backgroundStartingEquipment")[0];
		if (equipment !== undefined){
			description += '<p><strong>Equipment:</strong> ' + IncarnateRichText.convertSimple(equipment.getElementsByTagName("description")[0].innerHTML) + '</p>';
			const items = equipment.getElementsByTagName("includedItem");
			[].forEach.call(items, item=>{
				const fullItem = IncarnateConversions.lookupItem(ugf.getElementsByTagName("itemChapter")[0].getElementsByTagName("item"), item.getAttribute("FID"));
				flags.incarnateWorldBuilding.all.children.push({
					_id:item.getAttribute("FID"),
					level:0,
					name:item.getElementsByTagName("inculdedItemName")[0].innerHTML,
					type: IncarnateConversions.foundryItemType(fullItem.getElementsByTagName("itemType")[0].innerHTML),
					pack: "world.equipmentincarnate",
					quantity: Number(item.getElementsByTagName("inculdedItemQuantity")[0].innerHTML)
				});
			});
		}
		var gp = background.getElementsByTagName("backgroundGP")[0];
		if (gp !== undefined){
			flags.incarnateFiveEMod.clas.gp = Number(gp.innerHTML);
		}
		var backFeature = background.getElementsByTagName("backgroundFeature")[0];
		if (backFeature !== undefined){
			var featureName = backFeature.getElementsByTagName("backgroundFeatureName")[0].innerHTML;
			flags.incarnateWorldBuilding.all.children.push({
				_id:backFeature.getAttribute("FID"),
				level:0,
				name: featureName,
				type: "feat",
				pack: "world.backgroundincarnate"
			});
			description += '<h3>Feature: ' + featureName + '</h3>';
			description += backFeature.getElementsByTagName("backgroundFeatureDescription")[0].innerHTML;
		}
		description += '<h3>Suggested Characteristics</h3>';
		description += background.getElementsByTagName("backgroundCharacteristicsDescription")[0].innerHTML;
		var personality = background.getElementsByTagName("backgroundPersonality")[0];
		if (personality !== undefined){
			flags.incarnateFiveEMod.clas.suggestedCharacteristics.personality = personality.getAttribute("FID");
			description += IncarnateRichText.rollableTableToRichText(personality);
		}
		var ideal = background.getElementsByTagName("backgroundIdeal")[0];
		if (personality !== undefined){
			flags.incarnateFiveEMod.clas.suggestedCharacteristics.ideal = ideal.getAttribute("FID");
			description += IncarnateRichText.rollableTableToRichText(ideal);
		}
		var bond = background.getElementsByTagName("backgroundBond")[0];
		if (bond !== undefined){
			flags.incarnateFiveEMod.clas.suggestedCharacteristics.bond = bond.getAttribute("FID");
			description += IncarnateRichText.rollableTableToRichText(bond);
		}
		var flaw = background.getElementsByTagName("backgroundFlaw")[0];
		if (flaw !== undefined){
			flags.incarnateFiveEMod.clas.suggestedCharacteristics.flaw = flaw.getAttribute("FID");
			description += IncarnateRichText.rollableTableToRichText(flaw);
		}
		var otherCharacteristics = background.getElementsByTagName("backgroundMiscellaneous");
		[].forEach.call(otherCharacteristics, chr =>{
			description += IncarnateRichText.rollableTableToRichText(chr);
		});
		var quests = background.getElementsByTagName("questRecommendations")[0];
		if (quests !== undefined){
			description += '<h3>NPC Quest Recommendations</h3>';
			var tier = quests.getElementsByTagName("tier1")[0];
			if (tier !== undefined){
				description += IncarnateRichText.rollableTableToRichText(tier);
			}
			tier = quests.getElementsByTagName("tier2")[0];
			if (tier !== undefined){
				description += IncarnateRichText.rollableTableToRichText(tier);
			}
			tier = quests.getElementsByTagName("tier3")[0];
			if (tier !== undefined){
				description += IncarnateRichText.rollableTableToRichText(tier);
			}
			tier = quests.getElementsByTagName("tier4")[0];
			if (tier !== undefined){
				description += IncarnateRichText.rollableTableToRichText(tier);
			}
		}
		var legal = background.getElementsByTagName("backgroundLegal")[0];
		if (legal !== undefined){
			description += legal.innerHTML;
		}
		description = IncarnateRichText.convert(description);
		var source = background.getElementsByTagName("backgroundAuthor")[0].innerHTML;
		var vttCode = background.getElementsByTagName("VTTcode")[0];
		var img = "icons/svg/mystery-man.svg";
		if (vttCode !== undefined){
			img = IncarnateConversions.getToken(vttCode);
		}
		return {name:name,type:"class",data:{description:{value:description},levels:0,source:source},flags:flags,img:img,permission:{default:3}};
	}
	static assembleBackgroundFeature(background,ugf){
		var source = background.getElementsByTagName("backgroundAuthor")[0].innerHTML;
		const backgroundName = background.getElementsByTagName("backgroundName")[0].innerHTML;
		const feature = background.getElementsByTagName("backgroundFeature")[0];
		if (feature === undefined) return undefined;
		const name = feature.getElementsByTagName("backgroundFeatureName")[0].innerHTML;
		var description = "";
		description += feature.getElementsByTagName("backgroundFeatureDescription")[0].innerHTML;
		var legal = background.getElementsByTagName("backgroundLegal")[0];
		if (legal !== undefined){
			description += legal.innerHTML;
		}
		description = IncarnateRichText.convert(description);
		var flags = IncarnateFlags.fiveEfeat();
		var official = "fal";
		var officialTag = background.getElementsByTagName("officialContent")[0];
		if (officialTag !== undefined){
			official = IncarnateConversions.official(official.innerHTML);
		}
		flags.incarnateWorldBuilding.all.official = official;
		const originId = feature.getAttribute("FID");
		flags.incarnateWorldBuilding.all.origin = {
			level:0,
			name:name,
			pack:"world.backgroundincarnate",
			type:"feat",
			_id:originId
		};
		const backId = background.getAttribute("FID");
		flags.incarnateWorldBuilding.all.parents.push({
			_id:backId,
			level:0,
			name:backgroundName,
			type:"class",
			pack:"world.backgroundincarnate"
		});
		flags.incarnateFiveEMod.all.family = "background";
		var vttCode = background.getElementsByTagName("VTTcode")[0];
		var img = "icons/svg/mystery-man.svg";
		if (vttCode !== undefined){
			img = IncarnateConversions.getToken(vttCode);
		}
		return {name:name,data:{description:{value:description},requirements:backgroundName,source:source},flags:flags,img:img,type:"feat"};
	}
	// Spell Importing 
	static async importSpell(ugf){
		const oldPack = IncarnateReference.incarnatePackFind("world.spellincarnate");
		if (oldPack !== undefined){
			await oldPack.delete();
			await IncarnateReference.incarnateDelay(200);
		}
		const newPack = await Compendium.create({entity:"Item",label:"Spell (Incarnate)"});
		const spells = ugf.getElementsByTagName("spellsChapter")[0].getElementsByTagName("spell");
		console.time("spells");
		[].forEach.call(spells, async spell =>{
			const data = IncarnateImportFromUGF.assembleSpell(spell,ugf);
			await newPack.createEntity(data);
		});
		console.timeEnd("spells");
		return true;
	}
	static assembleSpell(spell,ugf){
		const name = spell.getElementsByTagName("spellName")[0].innerHTML;
		var flags = IncarnateFlags.fiveEspell();
		var source = spell.getElementsByTagName("author")[0].innerHTML;
		var description = spell.getElementsByTagName("spellDescription")[0].innerHTML;
		const legal = spell.getElementsByTagName("spellLegal")[0];
		if (legal !== undefined){
			description += legal.innerHTML;
		}
		description = IncarnateRichText.convert(description);
		const level = Number(spell.getElementsByTagName("spellLevel")[0].innerHTML);
		var vttCode = spell.getElementsByTagName("VTTcode")[0];
		var img = "icons/svg/mystery-man.svg";
		if (vttCode !== undefined){
			img = IncarnateConversions.getToken(vttCode);
		}
		const school = IncarnateConversions.school(spell.getElementsByTagName("spellSchool")[0].innerHTML);
		const components = IncarnateImportFromUGF.assembleComponents(spell);
		const materials = IncarnateImportFromUGF.assembleMaterials(spell);
		const activation = IncarnateImportFromUGF.assembleActivation(spell.getElementsByTagName("spellCastingTime")[0]);
		const duration = IncarnateImportFromUGF.assembleDuration(spell.getElementsByTagName("spellDuration")[0]);
		const scaling = IncarnateImportFromUGF.assembleHigherLevels(vttCode);
		const damage = IncarnateImportFromUGF.assembleDamage(vttCode);
		return {name:name,data:{activation:activation,components:components,damage:damage,description:{value:description},duration:duration,level:level,materials:materials,preparation:{mode:"prepared"},scaling:scaling,school:school,source:source},flags:flags,img:img,type:"spell"};
	}
	//
	//Assembled Functions
	//
	static assembleActivation(time){
		var type = time.getAttribute("unit") !== null ? IncarnateConversions.abilityActivation(time.getAttribute("unit")) : "";
		return{
			condition: time.getAttribute("condition") || "",
			cost: Number(time.getAttribute("number")) || 0,
			type: type
		}
	}
	static assembleComponents(spell){
		const concentration = Boolean(spell.getElementsByTagName("spellDuration")[0].getAttribute("concentration"));
		const components = spell.getElementsByTagName("spellComponents")[0];
		var ritual = spell.getElementsByTagName("spellRitual")[0];
		const result = {
			concentration: concentration,
			material: components.innerHTML.includes("M") ? true : false,
			ritual: ritual ? Boolean(ritual.innerHTML) : false,
			somatic: components.innerHTML.includes("S") ? true : false,
			value: "",
			vocal: components.innerHTML.includes("V") ? true : false
		}
		return result;
	}
	static assembleDamage(vttCode,param = {ability:true,proficiency:true}){
		result = {parts:[],versatile:""};
		const damagesNode = vttCode.getElementsByTagName("damages");
		if (damagesNode.length > 0){
			const damages = damagesNode[0].getElementsByTagName("damage");
			[].forEach.call(damages, damage=>{
				result.parts.push(IncarnateImportFromUGF.assembleDamageLine(damage));
			}
			if (damagesNode.length > 1){
			}
			//Add accounting for damage
		}else{
			const healsNode = vttCode.getElementsByTagName("heals")[0];
			if (healsNode !== undefined){
				//Add accounting for heal
			}else{
				const irregularAttacksNode = vttCode.getElementsByTagName("irregularAttack");
				if (irregularAttacksNode.length > 0){
					const higherLevelDamage = irregularAttacksNode[0].getElementsByTagName("higherLevelDamage")[0];
					if (higherLevelDamage !== undefined){
						//Add accounting for irregular attack
					}
				}
			}
		}
	}
	static assembleDamageLine(damage,param = {ability:true,proficiency:true}){
		var formula = damage.getElementsByTagName("formula")[0];
		if (formula === undefined){
			formula = "";
		}else{
			formula = formula.innerHTML;
		}
		if (param.ability){
			const ability = damage.getElementsByTagName("ability")[0];
			if (ability !== undefined){
				formula += " + @abilities." + IncarnateConversions.ability(ability.innerHTML) + ".mod";
			}
		}
		if (param.proficiency){
			const proficiency = damage.getElementsByTagName("proficiency")[0]{
				if (proficiency !== undefined && proficiency.innerHTML === "true"){
					formula += " + @attributes.prof";
				}
			}
		}
		const modifier = damage.getElementsByTagName("modifier")[0];
		if (modifier !== undefined){
			formula += " + " + modifier.innerHTML;
		}
		const damageType = damage.getElementsByTagName("damageType")[0];
		var type = "";
		if (damageType !== undefined){
			type = IncarnateConversions.damageType(damageType.innerHTML);
		}
		return [formula,type];
	}
	static assembleDuration(time){
		var units = time.getAttribute("unit") !== null ? IncarnateConversions.abilityDuration(time.getAttribute("unit")) : "";
		return{
			value: Number(time.getAttribute("number")) || 0,
			units:units
		}
	}
	static assembleHigherLevels(vttCode){
		var result = {};
		if (vttCode === undefined) return result;
		var higherLevelDamage = vttCode.getElementsByTagName("higherLevelDamage")[0];
		if (higherLevelDamage === undefined){
			const higherLevels = vttCode.getElementsByTagName("higherLevels")[0];
			if (higherLevels !== undefined){
				const type = IncarnateConversions.higherLevel(higherLevels.getElementsByTagName("type")[0].innerHTML);
				result.mode = type;
			}
		}else{
			const type = IncarnateConversions.higherLevel(higherLevelDamage.getElementsByTagName("type")[0].innerHTML);
			var formula = higherLevelDamage.getElementsByTagName("damage")[0].innerHTML;
			const ability = higherLevelDamage.getElementsByTagName("ability")[0];
			if (ability !== undefined){
				formula += " + @abilities." + IncarnateConversions.ability(ability.innerHTML) + ".mod";
			}
			const modifier = higherLevelDamage.getElementsByTagName("modifier")[0];
			if (modifier !== undefined){
				formula += modifier.innerHTML;
			}
			result = {mode:type,formula:formula};
		}
		return result;
	}
	static assembleMaterials(spell){
		const components = spell.getElementsByTagName("spellComponents")[0];
		return{
			value: components.getAttribute("components") || "",
			consumed: components.getAttribute("consumed") ? Boolean(components.getAttribute("consumed")) : false,
			cost: components.getAttribute("cost") ? Number(components.getAttribute("cost")) : 0
		}
	}
}
class IncarnateFlags{
	static worldAll(){
		return {
			incarnateWorldBuilding:{
				all:{
					children:[],
					lore:"",
					official:"",
					origin:{
						level:0,
						name:"",
						pack:"",
						type:"",
						_id:""
					},
					parents:[]
				}
			}
		}
	}
	static fiveEall(){
		return {
			all:{
				family:""
			}
		}
	}
	static fiveEfeat(){
		const worldBuilding = IncarnateFlags.worldAll();
		const fiveEall = IncarnateFlags.fiveEall();
		var result =  {
			incarnateFiveEMod:{
				feat:{
					ac:{
						active:false,
						boost:{
							abilities:[],
							base:0
						},
						formula:{
							abilities:[],
							base:0
						}
					},
					class:{
						value:[]
					},
					resources:[],
					skills:{value:[]},
					tools:{value:[]},
					type:""
				}
			}
		}
		result.incarnateWorldBuilding = worldBuilding.incarnateWorldBuilding;
		result.incarnateFiveEMod.all = fiveEall.all;
		return result;
	}
	static fiveEspell(){
		const worldBuilding = IncarnateFlags.worldAll();
		const fiveEall = IncarnateFlags.fiveEall();
		var result =  {
			incarnateFiveEMod:{
				class:{value:[]},
				components:{value:[]}
			}
		}
		result.incarnateWorldBuilding = worldBuilding.incarnateWorldBuilding;
		result.incarnateFiveEMod.all = fiveEall.all;
		return result;
	}
}
class IncarnateConversions{
	static getImage(vttCode){
		var img = "icons/svg/mystery-man.svg";
		const artworks = vttCode.getElementsByTagName("artwork");
		[].forEach.call(artworks, artwork =>{
			var image = artwork.getElementsByTagName("image")[0];
			if (image !== undefined){
				img = image.innerHTML;
			}
		});
		return img;
	}
	static getToken(vttCode){
		var img = "icons/svg/mystery-man.svg";
		const artworks = vttCode.getElementsByTagName("artwork");
		[].forEach.call(artworks, artwork =>{
			var image = artwork.getElementsByTagName("token")[0];
			if (image !== undefined){
				img = image.innerHTML;
			}
		});
		return img;
	}
	/*takes an array and returns a string where each word has been capitilized and items have been separated by ", "*/
	static capitalJoining(array){
		if (! array.length > 0) return "";
		var newString = IncarnateConversions.capitalizeWords(array[0]);
		for (var i=1; i<array.length; i++){
			newString += ', ' + IncarnateConversions.capitalizeWords(array[i]);
		}
		return newString;
	}
	static capitalizeWords(string){
		var splitStr = string.toLowerCase().split(' ');
		for (var i=0; i<splitStr.length; i++){
			splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
		}
		return splitStr.join(' ');
	}
	static lookupItem(htmlCollection,FID){
		var result = undefined;
		[].forEach.call(htmlCollection, item =>{
			if (item.getAttribute("FID") === FID){
				result = item;
			}
		});
		return result;
	}
	static foundryItemType(ugfItemType){
		return ugfItemType === "Adventuring Gear" ? "backpack" :
			ugfItemType === "Armor" ? "equipment" :
			ugfItemType === "Class Ability" ? "feat" :
			ugfItemType === "Food, Drink, and Lodging" ? "consumable" :
			ugfItemType === "Ingredient" ? "consumable" :
			ugfItemType === "Mounts and Other Animals" ? "backpack" :
			ugfItemType === "Monstrous Drop" ? "backpack" :
			ugfItemType === "Potion" ? "consumable" :
			ugfItemType === "Scroll" ? "consumable" :
			ugfItemType === "Tool" ? "tool" :
			ugfItemType === "Trade Good" ? "backpack" :
			ugfItemType === "Vehicle" ? "backpack" :
			ugfItemType === "Weapon" ? "weapon" :
			ugfItemType === "Wondrous Item" ? "backpack" :
			"";
	}
	static convert(value,object){
		var result = "";
		for (const key in object){
			if (object[key] === value){
				result = key;
			}
		}
		return result;
	}
	static ability(value){
		const result = IncarnateConversions.convert(value,CONFIG.incarnate.conversion.abilityListLower);
		return result;
	}
	static abilityActivation(value){
		const result = IncarnateConversions.convert(value,CONFIG.incarnate.conversion.abilityActivation);
		return result;
	}
	static abilityDuration(value){
		const result = IncarnateConversions.convert(value,CONFIG.incarnate.conversion.abilityDuration);
		return result;
	}
	static beastFunction(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateBeastFunction);
		return result;
	}
	static beastType(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateBeastType);
		return result;
	}
	static beastSubtype(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateBeastSubtype);
		return result;
	}
	static clas(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateClassList);
		return result;
	}
	static damageType(value){
		const result = IncarnateConversions.convert(value,CONFIG.incarnate.conversion.damageTypes);
		return result;
	}
	static higherLevel(value){
		const result = IncarnateConversions.convert(value,CONFIG.incarnate.conversion.spellScalingModes);
		return result;
	}
	static itemGenre(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateRecommendedItemGenre);
		return result;
	}
	static itemType(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateItemType);
		return result;
	}
	static itemSubtype(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateItemSubtype);
		return result;
	}
	static language(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.languages);
		return result;
	}
	static lore(lore){
		const result = IncarnateConversions.convert(lore,CONFIG.DND5E.incarnateLore);
		return result;
	}
	static official(official){
		const result = IncarnateConversions.convert(official,CONFIG.DND5E.incarnateOfficial);
		return result;
	}
	static recurrence(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateRecurrence);
		return result;
	}
	static school(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.spellSchools);
		return result;
	}
	static skill(skill){
		const result = IncarnateConversions.convert(skill,CONFIG.DND5E.incarnateSkillList);
		return result;
	}
	static terrain(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.incarnateBeastTerrain);
		return result;
	}
	static toolAll(tool){
		const result = IncarnateConversions.convert(tool,CONFIG.DND5E.incarnateTools);
		return result;
	}
	static weaponProp(value){
		const result = IncarnateConversions.convert(value,CONFIG.DND5E.weaponProperties);
		return result;
	}
	static defaultCompendium(ugfRef){
		return ugfRef.includes("bKbK") ? "world.backgroundincarnate" :
			ugfRef.includes("bKbO") ? "world.tableincarnate" :
			ugfRef.includes("bKfE") ? "world.backgroundincarnate" :
			ugfRef.includes("bKfL") ? "world.tableincarnate" :
			ugfRef.includes("bKiD") ? "world.tableincarnate" :
			ugfRef.includes("bKpE") ? "world.tableincarnate" :
			ugfRef.includes("cLaR") ? "world.classincarnate" :
			ugfRef.includes("cLaRtR") ? "world.classincarnate" :
			ugfRef.includes("cLcL") ? "world.classincarnate" :
			ugfRef.includes("clpRmUsK") ? "world.classincarnate" :
			ugfRef.includes("clpRsK") ? "world.classincarnate" :
			ugfRef.includes("cLtA") ? "world.classincarnate" :
			ugfRef.includes("cLtR") ? "world.classincarnate" :
			ugfRef.includes("eNeN") ? "world.encounterincarnate" :
			ugfRef.includes("fEfE") ? "world.featincarnate" :
			ugfRef.includes("iTiT") ? "world.equipmentincarnate" :
			ugfRef.includes("iTpA") ? "world.itempackincarnate" :
			ugfRef.includes("nPaC") ? "world.bestiaryincarnate" :
			ugfRef.includes("nPnP") ? "world.bestiaryincarnate" :
			ugfRef.includes("pLpL") ? "world.loreincarnate" :
			ugfRef.includes("pLaN") ? "world.loreincarnate" :
			ugfRef.includes("pLnPC") ? "world.loreincarnate" :
			ugfRef.includes("pOiN") ? "world.loreincarnate" :
			ugfRef.includes("pOsU") ? "world.loreincarnate" :
			ugfRef.includes("rAbO") ? "world.tableincarnate" :
			ugfRef.includes("rAfL") ? "world.tableincarnate" :
			ugfRef.includes("rAiD") ? "world.tableincarnate" :
			ugfRef.includes("rApE") ? "world.tableincarnate" :
			ugfRef.includes("rArA") ? "world.raceincarnate" :
			ugfRef.includes("rAtR") ? "world.raceincarnate" :
			ugfRef.includes("rAsU") ? "world.raceincarnate" :
			ugfRef.includes("rAsUtR") ? "world.raceincarnate" :
			ugfRef.includes("rIrI") ? "world.riddlesincarnate" :
			ugfRef.includes("sEsE") ? "world.ruleincarnate" :
			ugfRef.includes("sE2sE") ? "world.ruleincarnate" :
			ugfRef.includes("sE3sE") ? "world.ruleincarnate" :
			ugfRef.includes("sE4sE") ? "world.ruleincarnate" :
			ugfRef.includes("sE5sE") ? "world.ruleincarnate" :
			ugfRef.includes("sE6sE") ? "world.ruleincarnate" :
			ugfRef.includes("sKsK") ? "world.ruleincarnate" :
			ugfRef.includes("sPsP") ? "world.spellincarnate" :
			ugfRef.includes("tAtA") ? "world.tableincarnate" :
			ugfRef.includes("iTpAiT") ? "notsupported" :
			ugfRef.includes("mAiTtE") ? "notsupported" :
			ugfRef.includes("iNrE") ? "notsupported" :
			ugfRef.includes("cHcH") ? "notsupported" :
			"notsupported";
	}
	static matchType(ugfRef){
		return ugfRef.includes("bKbK") ? "Item" :
			ugfRef.includes("bKbO") ? "Table" :
			ugfRef.includes("bKfE") ? "Item" :
			ugfRef.includes("bKfL") ? "Table" :
			ugfRef.includes("bKiD") ? "Table" :
			ugfRef.includes("bKpE") ? "Table" :
			ugfRef.includes("cHcH") ? "JournalEntry" :
			ugfRef.includes("cLaR") ? "Item" :
			ugfRef.includes("cLaRtR") ? "Item" :
			ugfRef.includes("cLcL") ? "Item" :
			ugfRef.includes("clpRmUsK") ? "Item" :
			ugfRef.includes("clpRsK") ? "Item" :
			ugfRef.includes("cLtA") ? "Item" :
			ugfRef.includes("cLtR") ? "Item" :
			ugfRef.includes("eNeN") ? "Encounter" :
			ugfRef.includes("fEfE") ? "Item" :
			ugfRef.includes("iNrE") ? "internalReference" :
			ugfRef.includes("iTiT") ? "Item" :
			ugfRef.includes("iTpA") ? "Actor" :
			ugfRef.includes("iTpAiT") ? "Actor" :
			ugfRef.includes("mAiTtE") ? "Item" :
			ugfRef.includes("nPaC") ? "Actor" :
			ugfRef.includes("nPnP") ? "Actor" :
			ugfRef.includes("pLpL") ? "JournalEntry" :
			ugfRef.includes("pLaN") ? "JournalEntry" :
			ugfRef.includes("pLnPC") ? "JournalEntry" :
			ugfRef.includes("pOiN") ? "JournalEntry" :
			ugfRef.includes("pOsU") ? "JournalEntry" :
			ugfRef.includes("rAbO") ? "Table" :
			ugfRef.includes("rAfL") ? "Table" :
			ugfRef.includes("rAiD") ? "Table" :
			ugfRef.includes("rApE") ? "Table" :
			ugfRef.includes("rArA") ? "Item" :
			ugfRef.includes("rAtR") ? "Item" :
			ugfRef.includes("rAsU") ? "Item" :
			ugfRef.includes("rAsUtR") ? "Item" :
			ugfRef.includes("rIrI") ? "JournalEntry" :
			ugfRef.includes("sEsE") ? "JournalEntry" :
			ugfRef.includes("sE2sE") ? "JournalEntry" :
			ugfRef.includes("sE3sE") ? "JournalEntry" :
			ugfRef.includes("sE4sE") ? "JournalEntry" :
			ugfRef.includes("sE5sE") ? "JournalEntry" :
			ugfRef.includes("sE6sE") ? "JournalEntry" :
			ugfRef.includes("sKsK") ? "JournalEntry" :
			ugfRef.includes("sPsP") ? "Item" :
			ugfRef.includes("tAtA") ? "Table" :
			ugfRef + " type not found";
	}
}
class IncarnateRichText{
	static convert(text){
		var node = document.createElement("div");
		node.innerHTML = text;
		node = IncarnateRichText.replaceAllTags(node,'b','strong');
		node = IncarnateRichText.replaceAllTags(node,'i','em');
		node = IncarnateRichText.replaceAllTags(node,'list','ul');
		node = IncarnateRichText.replaceAllTags(node,'h','h1');
		node = IncarnateRichText.replaceAllTags(node,'emphaticParagraph','blockquote');
		node.innerHTML = node.innerHTML.replace(/<quoMark\/>/g,'"');
		node = IncarnateRichText.hyperlink(node);
		node = IncarnateRichText.centeredText(node);
		node = IncarnateRichText.crossReference(node);
		node = IncarnateRichText.genLink(node);
		node = IncarnateRichText.generate(node);
		node = IncarnateRichText.underline(node);
		node = IncarnateRichText.heading(node);
		node = IncarnateRichText.populate(node);
		node = IncarnateRichText.sound(node);
		node = IncarnateRichText.roll(node);
		node = IncarnateRichText.secret(node,"privateParagraph");
		node = IncarnateRichText.secret(node,"speechBubble");
		node = IncarnateRichText.tableToRichText(node);
		return node.innerHTML;
	}
	static convertSimple(text){
		var node = document.createElement("div");
		node.innerHTML = text;
		node.innerHTML = node.innerHTML.replace(/<quoMark\/>/g,'"');
		node = IncarnateRichText.crossReference(node);
		return node.innerHTML;
	}
	static tableToRichText(node){
		const tables = node.getElementsByTagName("table");
		[].forEach.call(tables, table=>{
			table.setAttribute("border","1");
			table.innerHTML = "<tbody>" + table.innerHTML + "</tbody>";
			const headers = table.getElementsByTagName("th");
			[].forEach.call(headers, header =>{
				const newHeader = document.createElement("tr");
				if (header.getAttribute("colspan") != null){
					newHeader.setAttribute("colspan",header.getAttribute("colspan"));
				}
				header.parentNode.replaceChild(newHeader,header);
			});
		});
		return node;
	}
	static rollableTableToRichText(node){
		var rich = "<h3>" + node.getElementsByTagName("title")[0].innerHTML + "</h3>";
		rich += '<table border=\"1\" id=\"' + node.getAttribute("FID") + '\">\n<tbody>';
		var rows = node.getElementsByTagName("tr");
		[].forEach.call(rows, row=>{
			rich += '<tr><td>' + row.getElementsByTagName('rollfrom')[0].innerHTML + '</td><td>' + row.getElementsByTagName('rollto')[0].innerHTML + '</td>';
			var columns = row.getElementsByTagName("td");
			[].forEach.call(columns, column =>{
				rich += '<td>' + column.innerHTML + '</td>';
			});
			columns = row.getElementsByTagName("th");
			[].forEach.call(columns, column =>{
				rich += '<td><strong>' + column.innerHTML + '</strong></td>';
			});
			rich += '</tr>';
		});
		rich += '</tbody>\n</table>';
		return rich;
	}
	static crossReference(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("crossReference")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("span");
				const parRef = oldNode.getAttribute("UGFparent");
				const ref = oldNode.getAttribute("UGFLinkReference");
				var ugfRef = parRef || ref; 
				const type = IncarnateConversions.matchType(ugfRef);
				const pack = "world." + IncarnateConversions.defaultCompendium(ugfRef);
				newNode.setAttribute("class","crossReference");
				newNode.setAttribute("data-fid",oldNode.getAttribute("FID"));
				newNode.setAttribute("data-type",type);
				newNode.setAttribute("data-pack",pack);
				newNode.setAttribute("data-parent",parRef);
				newNode.setAttribute("draggable",true);
				newNode.setAttribute("ondragstart","IncarnateReference.onDragStart(event)");
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static heading(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("h")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const level = oldNode.getAttribute("sublevel");
				if (level === undefined){
					const newNode = document.createElement("p");
					newNode.innerHTML = "<strong><em>" + oldNode.innerHTML + "</em></strong>";
					oldNode.parentNode.replaceChild(newNode,oldNode);
				}else{
					const newNode = document.createElement("h" + level);
					newNode.innerHTML = oldNode.innerHTML;
					oldNode.parentNode.replaceChild(newNode,oldNode);
				}
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static roll(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("roll")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createTextNode("@Roll[" + oldNode.innerHTML + "]");
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static sound(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("sound")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("p");
				newNode.innerHTML = '<a href="' + oldNode.getAttribute("path") + '">' + oldNode.innerHTML + '</a>';
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static secret(node,label){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName(label)[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("span");
				newNode.setAttribute("class","secret");
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static underline(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("u")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("span");
				newNode.setAttribute("style","text-decoration: underline;");
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static populate(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("populate")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("span");
				newNode.setAttribute("class","populate");
				newNode.setAttribute("data-fid",oldNode.getAttribute("FID"));
				newNode.setAttribute("data-quantity",oldNode.getAttribute("quantity"));
				newNode.setAttribute("data-recurrance",oldNode.getAttribute("data-recurrance"));
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static generate(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("generate")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("span");
				newNode.setAttribute("class","generate");
				newNode.setAttribute("data-fid",oldNode.getAttribute("FID"));
				newNode.setAttribute("data-quantity",oldNode.getAttribute("quantity"));
				newNode.setAttribute("data-recurrance",oldNode.getAttribute("data-recurrance"));
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static genLink(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("genLink")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("span");
				newNode.setAttribute("class","genLink");
				newNode.setAttribute("data-fid",oldNode.getAttribute("FID"));
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static centeredText(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var oldNode = node.getElementsByTagName("centeredText")[0];
			if (oldNode === undefined){
				found = false;
			}else{
				const newNode = document.createElement("p");
				newNode.setAttribute("style","text-align: center;");
				newNode.innerHTML = oldNode.innerHTML;
				oldNode.parentNode.replaceChild(newNode,oldNode);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static hyperlink(node){
		var found = true;
		var abort = 0;
		while (found === true && abort < 50){
			var hyperlink = node.getElementsByTagName("hyperlink")[0];
			if (hyperlink === undefined){
				found = false;
			}else{
				const newNode = document.createElement("a");
				newNode.setAttribute("href",hyperlink.getAttribute("uri"));
				newNode.innerHTML = hyperlink.innerHTML;
				hyperlink.parentNode.replaceChild(newNode,hyperlink);
			}
			abort++;
		}
		if (abort == 50){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static replaceAllTags(node,oldTag,newTag){
		if (oldTag === newTag) return node;
		var found = true;
		var abort = 0;
		while (found === true && abort < 10000){
			var replaceNode = node.getElementsByTagName(oldTag)[0];
			if (replaceNode === undefined){
				found = false;
			}else{
				const newNode = IncarnateRichText.replaceTag(replaceNode,newTag);
				replaceNode.parentNode.replaceChild(newNode,replaceNode);
			}
			abort++;
		}
		if (abort == 10000){
			console.warn("Warning: abort script triggered on",node,oldTag,newTag);
		}
		return node;
	}
	static replaceTag(node,newTag){
		const newNode = document.createElement(newTag);
		newNode.innerHTML = node.innerHTML;
		return newNode;
	}
}
