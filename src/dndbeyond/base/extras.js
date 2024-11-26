class MonsterExtras extends CharacterBase {
    constructor(_type, base = null, global_settings = null, {character, creatureType}={}) {
        super(_type, global_settings);
        if (base) {
            this._base = base;
        }
        this._prefix = "monster_extras_";
        this._creatureType = creatureType;
        this._parent_character = character;
        this._stat_block = $(this._base);
        this._id = null;
        this._name = null;
        this._avatar = null;
        this._meta = null;
        this._attributes = {}
        this._ac = null;
        this._ac_meta = null;
        this._hp = null;
        this._hp_formula = null;
        this._max_hp = 0;
        this._temp_hp = 0;
        this._speed = null;
        this._abilities = [];
        this._tidbits = {}
        this._saves = {}
        this._skills = {}
        this._spells = {}
        this._cr = null;
    }

    // ddbc-creature-block styles_creatureBlock__OEQz9 blockfinder
    
    getSetting(key, default_value = "", settings = null) {
        // Use parent's settings for wild shape creatures
        if (this.type() == "creature" && this._creatureType?.startsWith("Wild Shape") && this._parent_character) {
            return this._parent_character.getSetting(key, default_value, settings);
        }
        return super.getSetting(key, default_value, settings);
    }

    parseStatBlock(stat_block) {
        const add_dice = this.getGlobalSetting('handle-stat-blocks', true);
        const inject_descriptions = this.getGlobalSetting('subst-dndbeyond-stat-blocks', true);
        const beyond20_tooltip = add_dice || inject_descriptions ? getQuickRollTooltip() : null;
        const base = this._base;
        const classNames = {};
        if (!stat_block)
            stat_block = $(base);

        this._stat_block = stat_block;
        this._name = stat_block.find("section[class*='styles_creatureBlock'] > h1[class*='styles_header']").text().trim();
        this._id = this._name;
        this._meta = stat_block.find("section[class*='styles_creatureBlock'] > p[class*='styles_meta']").text().trim();

        const avatar = $(base).parent().find("img[class*='styles_img']");
        if (avatar.length > 0) {
            this._avatar = avatar[0].src;
            addDisplayButton(() => this.displayAvatar(), avatar, { small: false, image: true });
        }

        // Attributes

        const attributes = stat_block.find("div[class*='styles_attribute__']");
        for (let attr of attributes.toArray()) {
            const label = $(attr).find("h2[class*='styles_attributeLabel']").text().trim();
            const values = $(attr).find("p[class*='styles_attributeValue']");

            classNames["attribute"] = $(attr).attr("class");
            classNames["label"] = $(attr).find("h2[class*='styles_attributeLabel']").attr("class");
            classNames["value"] = $(values).eq(0).attr("class");
            
            if (label == "Armor Class") {
                if(values.length != 0) {
                    this._ac = $(values[0]).text().trim();
                    this._ac_meta = values[1] ? $(values[1]).text().trim().replace(/[()]/g, '') : undefined;
                }
                // add wild shape 2024 feature here if the player has the class level
            } else if (label == "Hit Points") {
                if(values.length != 0) {
                    this._hp = $(values[0]).text().trim();
                    this._hp_formula = values[1] ? $(values[1]).text().trim().replace(/[()]/g, '') : undefined;
                    
                    if (add_dice) {
                        const digitalDiceBox = $(attr).find(this._prefix + "__attribute-data-extra .integrated-dice__container");
                        if (digitalDiceBox.length > 0) {
                            // Use the digital Dice box (encounters page)
                            digitalDiceBox.off('click').on('click', (e) => {
                                e.stopPropagation();
                                this.rollHitPoints();
                            })
                            deactivateTooltipListeners(digitalDiceBox);
                            activateTooltipListeners(digitalDiceBox, "right", beyond20_tooltip, () => this.rollHitPoints());
                        } else {
                            if (this.isBlockFinder) {
                                addIconButton(this, () => this.rollHitPoints(), $(attr), {custom: true, append: true});
                            } else {
                                addIconButton(this, () => this.rollHitPoints(), $(values[1]), {custom: true});
                            }
                        }
                    }
                }
                
                
            } else if (label == "Speed") {
                this._speed = $(values[0]).text().trim();
            }
            this._attributes[label] = [...$(values)].map(m => $(m).text().trim()).filter(Boolean).join(", ");
        }

        // Abilities

        const abilities = stat_block.find("div[class*='styles_stats'] > div[class*='styles_stat']");
        let initiative_selector = this._prefix + "__beyond20-roll-initiative";
        for (let ability of abilities.toArray()) {
            const abbr = $(ability).find("h2[class*='styles_statHeading']").text().toUpperCase();
            const score = $(ability).find("p[class*='styles_statScore']").text();
            const modifier = $(ability).find("p[class*='styles_statModifier']").text().slice(1, -1);
            this._abilities.push([abbreviationToAbility(abbr), abbr, score, modifier]);
            if (add_dice) {
                const digitalDiceBox = $(ability).find(this._prefix + "modifier .integrated-dice__container");
                if (digitalDiceBox.length > 0) {
                    // Use the digital Dice box (encounters page)
                    digitalDiceBox.off('click').on('click', (e) => {
                        e.stopPropagation();
                        this.rollAbilityCheck(abbr)
                    })
                    deactivateTooltipListeners(digitalDiceBox);
                    activateTooltipListeners(digitalDiceBox, "down", beyond20_tooltip, () => this.rollAbilityCheck(abbr));
                } else {
                    addIconButton(this, () => this.rollAbilityCheck(abbr), ability, { prepend: true });
                }
                if (abbr == "DEX") {
                    const lastAttribute = attributes.last();
                    let roll_initiative = stat_block.find(initiative_selector);
                    if (attributes.length > 0) {
                        let initiative = roll_initiative.eq(0);
                        // Make sure the modifier didn't change (encounters)
                        if (roll_initiative.length > 0 && roll_initiative.attr("data-modifier") !== modifier) {
                            initiative = null;
                            roll_initiative.remove();
                            roll_initiative = [];
                        }
                        if (roll_initiative.length == 0) {
                            if (this.isBlockFinder) {
                                initiative = $(
                                    E.p({ class: `Stat-Block-Styles_Stat-Block-Data ${initiative_selector.slice(1)}`,
                                            "data-modifier": modifier },
                                        E.strong({ class: `block-finder-attribute-label` }, "Roll Initiative!"),
                                        E.span({ class: `block-finder-data` }, "  " + modifier)
                                    )
                                );
                            } else { 
                                const attribute_prefix = `${this._prefix}__attribute`
                                initiative = $(
                                    E.div({ class: `${attribute_prefix} ${initiative_selector} ${classNames["attribute"]}`,
                                            "data-modifier": modifier },
                                        E.span({ class: `${attribute_prefix}-label ${classNames["label"]}` }, "Roll Initiative!"),
                                        E.span({ class: `${attribute_prefix}-data` },
                                            E.span({ class: `${attribute_prefix}-data-value ${classNames["value"]}` }, "  " + modifier)
                                        )
                                    )
                                );
                            }
                        }
                        attributes.last().after(initiative);
                        addIconButton(this, () => this.rollInitiative(), initiative, { append: true });
                    }
                }
            }
        }

        // tidbits

        const tidbits = stat_block.find("div[class*='styles_tidbit']");
        for (let tidbit of tidbits.toArray()) {
            const label = $(tidbit).find("h2[class*='styles_tidbitLabel']").text().trim();
            const data = $(tidbit).find("p");
            const value = $(data).text().trim();
            const digitalDiceBoxes = data.find(".integrated-dice__container");
            if (label == "Saving Throws") {
                const saves = value.split(", ");
                const useDigitalDice = digitalDiceBoxes.length === saves.length;
                if (add_dice && !useDigitalDice) data.html("");
                for (let save of saves) {
                    const parts = save.split(" ");
                    const abbr = parts[0];
                    const mod = parts.slice(1).join(" ");
                    this._saves[abbr] = mod;
                    if (useDigitalDice) {
                        // Hook into the existing digital dice boxes
                        const idx = saves.indexOf(save);
                        const digitalDiceBox = digitalDiceBoxes.eq(idx);
                        // Use the digital Dice box (encounters page)
                        digitalDiceBox.off('click').on('click', (e) => {
                            e.stopPropagation();
                            this.rollSavingThrow(abbr);
                        })
                        deactivateTooltipListeners(digitalDiceBox);
                        activateTooltipListeners(digitalDiceBox, "down", beyond20_tooltip, () => this.rollSavingThrow(abbr));
                    } else if (add_dice) {
                        data.append(abbr + " " + mod);
                        addIconButton(this, () => this.rollSavingThrow(abbr), data, { append: true });
                        if (saves.length > Object.keys(this._saves).length)
                            data.append(", ");
                    }
                }
            } else if (label == "Skills") {
                const skills = value.split(", ");
                const useDigitalDice = digitalDiceBoxes.length === skills.length;
                for (let skill of skills) {
                    const match = skill.match(/(.+?)([+-]?)\s*([0-9]+)/);
                    if (match) {
                        const name = match[1].trim();
                        const mod = `${match[2] || "+"}${match[3]}`;
                        this._skills[name] = mod;
                        // Hook into the existing digital dice boxes
                        if (useDigitalDice) {
                            const idx = skills.indexOf(skill);
                            const digitalDiceBox = digitalDiceBoxes.eq(idx);
                            // Use the digital Dice box (encounters page)
                            digitalDiceBox.off('click').on('click', (e) => {
                                e.stopPropagation();
                                this.rollSkillCheck(name)
                            })
                            deactivateTooltipListeners(digitalDiceBox);
                            activateTooltipListeners(digitalDiceBox, "down", beyond20_tooltip, () => this.rollSkillCheck(name));
                        }
                    }
                }
                if (useDigitalDice || !add_dice)
                    continue;
                data.html("");
                let first = true;
                for (let skill in this._skills) {
                    if (!first)
                        data.append(", ");
                    first = false;
                    data.append(skill + " " + this._skills[skill]);
                    addIconButton(this, () => this.rollSkillCheck(skill), data, { append: true });
                }
            } else if (label == "Challenge") {
                this._cr = value.split(" ")[0];
            }
            this._tidbits[label] = value;
        }

        //console.log("Done parsing stat block:", this);
    }

    rollHitPoints() {
        sendRoll(this, "custom", this._hp_formula, {
            "name": "Hit Points",
            "modifier": this._hp_formula
        });
    }

    rollAbilityCheck(abbr) {
        for (let ability of this._abilities) {
            if (ability[1] == abbr) {
                const [name, abbr, score, modifier] = ability;
                const roll_properties = {
                    "name": name,
                    "ability": abbr,
                    "modifier": modifier,
                    "ability-score": score
                };
                if (abbr == "STR" && this.type() == "Creature" && this._creatureType === "Wild Shape" && this._parent_character && 
                    this._parent_character.hasClassFeature("Rage") && this._parent_character.getSetting("barbarian-rage", false)) {
                    roll_properties["advantage"] = RollType.OVERRIDE_ADVANTAGE;
                }
                
                if (this.type() == "Creature" && this._creatureType === "Wild Shape" && this._parent_character &&
                    this._parent_character.getSetting("custom-ability-modifier", "")) {
                    const custom = parseInt(this._parent_character.getSetting("custom-ability-modifier", "0")) || 0;
                    if (custom != 0)  {
                        let customModifier = parseInt(modifier) + custom;
                        customModifier = customModifier >= 0 ? `+${customModifier}` : `${customModifier}`;
                        roll_properties["modifier"] = customModifier;
                    }
                }
                sendRoll(this, "ability", "1d20" + modifier, roll_properties);
                break;
            }
        }
    }
    
    rollInitiative() {
        for (let ability of this._abilities) {
            if (ability[1] == "DEX") {
                const modifier = ability[3];

                let initiative = modifier;
                if (this.getGlobalSetting("initiative-tiebreaker", false)) {
                    const tiebreaker = ability[2];

                    // Add tiebreaker as a decimal;
                    initiative = parseFloat(initiative) + parseFloat(tiebreaker) / 100;

                    // Render initiative as a string that begins with '+' || '-';
                    initiative = initiative >= 0 ? '+' + initiative.toString() : initiative.toString();
                }

                sendRoll(this, "initiative", "1d20" + initiative, { "initiative": initiative });
                break;
            }
        }
    }

    rollSavingThrow(abbr) {
        const mod = this._saves[abbr];
        const name = abbreviationToAbility(abbr);
        const roll_properties = {
            "name": name,
            "ability": abbr,
            "modifier": mod
        };
        if (abbr == "STR" && this.type() == "Creature" && this._creatureType === "Wild Shape" && this._parent_character && 
            this._parent_character.hasClassFeature("Rage") && this._parent_character.getSetting("barbarian-rage", false)) {
            roll_properties["advantage"] = RollType.OVERRIDE_ADVANTAGE;
        }
        sendRoll(this, "saving-throw", "1d20" + mod, roll_properties);
    }

    rollSkillCheck(skill) {
        const modifier = this._skills[skill];
        const ability = skillToAbility(skill);
        const roll_properties = {
            "skill": skill,
            "ability": ability,
            "modifier": modifier
        };
        if (ability == "STR" && this.type() == "Creature" && this._creatureType === "Wild Shape" && this._parent_character && 
            this._parent_character.hasClassFeature("Rage") && this._parent_character.getSetting("barbarian-rage", false)) {
            roll_properties["advantage"] = RollType.OVERRIDE_ADVANTAGE;
        }
        sendRoll(this, "skill", "1d20" + modifier, roll_properties);
    }

    displayAvatar() {
        sendRoll(this, "avatar", this._avatar, { "name": "Avatar" });
    }

    updateInfo() {

    }

    getDict() {
        let settings = undefined;
        if (this.type() == "creature" && this._parent_character && this._creatureType?.startsWith("Wild Shape")) {
            const parentDict = this._parent_character.getDict();
            settings = parentDict.settings;
        }
        return {
            "name": this._name,
            "source": "D&D Beyond",
            "avatar": this._avatar,
            "type": this.type(),
            "creatureType": this._creatureType,
            "settings": settings,
            "id": this._id,
            "ac": this._ac,
            "hp": this._hp,
            "hp-formula": this._hp_formula,
            "max-hp": this._max_hp,
            "temp-hp": this._temp_hp,
            "speed": this._speed,
            "abilities": this._abilities,
            "actions": this._actions,
            "discord-target": this._parent_character && this._parent_character.getSetting("discord-target", undefined),
            "saves": this._saves,
            "skills": this._skills,
            "cr": this._cr,
            "url": this._url
        }
    }
}