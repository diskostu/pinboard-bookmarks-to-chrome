var ALL_POSTS_REQUEST_LIMIT_IN_SEC = 300;
var ROOT_NODE_ID = 'node_0';

var DEFAULT_AND_DELIMITER = ';';
var DEFAULT_OR_DELIMITER = '|';

var tagLogicalAndDelimiter = DEFAULT_AND_DELIMITER;
var tagLogicalOrDelimiter = DEFAULT_OR_DELIMITER;

var ENABLED_TEXT_COLOR = "#000";
var DISABLED_TEXT_COLOR = "#666";

var allBookmarks;
var rootBookmarkIds;


function disableInputElements(message) {
    ['#tagTree','#apiToken','#verifyApiToken','#generateBookmarks','#tagContainer','#searchFilter'].forEach(function(element) {
        $(element).addClass('disabledElement');
    });
    $("#innerNotice").text(message + '...');
}

function enableInputElements() {
    ['#tagTree','#apiToken','#verifyApiToken','#generateBookmarks','#tagContainer','#searchFilter'].forEach(function(element) {
        $(element).removeClass("disabledElement");
    });
    $("#innerNotice").text('');
}


/***********************************
 LOADING AND MANIPULATING TAG DATA
************************************/

function retrieveAndDisplayAllTags(apiToken) {
    var client = new XMLHttpRequest();
    client.open("GET", 'https://api.pinboard.in/v1/tags/get?format=json&auth_token=' + apiToken);
    client.onload = function(e) {
        if (client.status == 200) {
            disableInputElements("Loading Tags from Pinboard");
            $("#tagContainer").empty();
            $('#searchFilter').off('input');
            JSON.parse(client.responseText, (tagName, tagCount) =>
            {
                if (tagName != '') {
                    var element = document.createElement('button');
                    element.textContent = tagName.toLowerCase();
                    element.addEventListener('click', function() {
                        jstree_node_create(tagName.toLowerCase());
                    });
                    element.classList.add("tag");
                    $("#tagContainer").append(element);
                }
            });
            applyTagListFilter();
            enableInputElements();
        } else {
            logInvalidResponse('/tags/get', client);
        }
    };
    client.onerror = function(e) {
        throw e;
    };
    client.send();
}

function loadSelectedTagsFromStorage() {
    chrome.storage.local.get('selected_tags', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load your previously selected tags from storage:\n\n" + chrome.runtime.lastError.message);
        }
        if (result != undefined && result.selected_tags != undefined) {
            generateTagTree(result.selected_tags);
        } else {
            generateTagTree([{"id":ROOT_NODE_ID, "text":"Pinboard", "icon":"images/root.gif"}]);
        }
        enableInputElements();
    });
}

function getSelectedTagDataJson() {
    return $('#tagTree').jstree(true).get_json('#');
}

function getDistinctTagNames() {
    var names = getAllNamesFromTagTree(getSelectedTagDataJson());
    return names.filter((v, i, a) => a.indexOf(v) === i);
}

function getAllNamesFromTagTree(treeNode) {
    var childNodeText = [];
    for (var i = 0; i < treeNode.length; i++) {
        if (treeNode[i]['type'] == 'default') {
            childNodeText = childNodeText.concat(getAllNamesFromTagTree(treeNode[i]["children"]));
        } else {
            childNodeText.push(treeNode[i]["text"].toLowerCase());
        }
    }
    return childNodeText;
}

function generateTagTree(data) {
    $('#tagTree').jstree({
        'core' : {
            'animation' : 100,
            'themes' : { 'stripes' : false },
            'multiple' : false,
            'check_callback' : true,
            'data' : data,
        },
        'types' : {
            '#' : {
                'max_children' : 1,
                'valid_children' : ['root']
            },
            'root' : {
                'icon' : '../../images/tree_icon.png',
                'valid_children' : ['default']
            },
            'default' : {
                'valid_children' : ['default', 'file']
            },
            'file' : {
                'icon' : '../../images/bookmark_icon.png',
                'valid_children' : []
            }
        },
        'plugins' : [
            'contextmenu', 'dnd', 'sort',
            'state', 'types', 'wholerow'
        ],
        'sort' : function (a, b) {
    		return this.get_type(a) === this.get_type(b)
                ? (this.get_text(a).toLowerCase() > this.get_text(b).toLowerCase() ? 1 : -1)
                : (this.get_type(a) >= this.get_type(b) ? 1 : -1)
        },
        'contextmenu' : {
            'items' : function (node, callback) {
    			return {
    				"create_folder" : {
    					"separator_before"	: false,
    					"separator_after"	: false,
    					"_disabled"			: node.type == 'file',
    					"label"				: "Add Folder",
    					"action"			: function (data) {
    						var inst = $.jstree.reference(data.reference);
    						inst.create_node(node, { "text" : "New Folder" }, "last", function (new_node) {
    							setTimeout(function () { inst.edit(new_node); },0);
    						});
    					}
    				},
    				"rename_folder" : {
    					"separator_before"	: false,
    					"separator_after"	: false,
    					"_disabled"			: node.type == 'file',
    					"label"				: "Rename Folder",
    					"action"			: function (data) {
    						var inst = $.jstree.reference(data.reference);
    						inst.edit(node);
    					}
    				},
    				"remove_folder" : {
    					"separator_before"	: false,
    					"separator_after"	: false,
    					"_disabled"			: node.type != 'default',
    					"label"				: "Delete Folder",
    					"action"			: function (data) {
    						var inst = $.jstree.reference(data.reference);
                            if (node.type == 'default' && node.children.length > 0
                                && $('#confirm_before_deleting_folder').is(':checked')
                                && !(confirm('Really delete this folder and all of its contents?'))) {
                                        return true;
                            }
    						if(inst.is_selected(node)) {
    							inst.delete_node(inst.get_selected());
    						}
    						else {
    							inst.delete_node(node);
    						}
    					}
    				},
    				"create_tag" : {
    					"separator_before"	: true,
    					"separator_after"	: false,
    					"_disabled"			: node.type == 'file',
    					"label"				: "Add Tag",
    					"action"			: function (data) {
                            jstree_node_create();
    					}
    				},
    				"rename_tag" : {
    					"separator_before"	: false,
    					"separator_after"	: false,
    					"_disabled"			: node.type != 'file',
    					"label"				: "Rename Tag",
    					"action"			: function (data) {
    						jstree_node_rename();
    					}
    				},
    				"remove_tag" : {
    					"separator_before"	: false,
    					"separator_after"	: false,
    					"_disabled"			: node.type != 'file',
    					"label"				: "Delete Tag",
    					"action"			: function (data) {
    						jstree_node_delete();
    					}
    				},
    				"ccp" : {
    					"separator_before"	: true,
    					"icon"				: false,
    					"separator_after"	: false,
    					"label"				: "Edit",
    					"_disabled"			: false,
    					"action"			: false,
    					"submenu" : {
    						"cut" : {
    							"separator_before"	: false,
    							"separator_after"	: false,
    							"label"				: "Cut",
                                "_disabled"         : node.id == 'node_0',
    							"action"			: function (data) {
    								var inst = $.jstree.reference(data.reference);
    								if(inst.is_selected(node)) {
    									inst.cut(inst.get_top_selected());
    								}
    								else {
    									inst.cut(node);
    								}
    							}
    						},
    						"copy" : {
    							"separator_before"	: false,
    							"icon"				: false,
    							"separator_after"	: false,
    							"label"				: "Copy",
                                "_disabled"         : node.id == 'node_0',
    							"action"			: function (data) {
    								var inst = $.jstree.reference(data.reference);
    								if(inst.is_selected(node)) {
    									inst.copy(inst.get_top_selected());
    								}
    								else {
    									inst.copy(node);
    								}
    							}
    						},
    						"paste" : {
    							"separator_before"	: false,
    							"icon"				: false,
    							"_disabled"			: function (data) {
    								return !$.jstree.reference(data.reference).can_paste();
    							},
    							"separator_after"	: false,
    							"label"				: "Paste",
    							"action"			: function (data) {
    								var inst = $.jstree.reference(data.reference);
    								inst.paste(node);
    							}
    						}
    					}
    				}
    			};
    		}
        }
    });
}

/***********************
 JSTREE NODE FUNCTIONS
************************/

function jstree_node_create(nodeName = null) {
	var tagTree = $('#tagTree').jstree();
    var selectedNodeIds = tagTree.get_selected();
    var firstNodeId = selectedNodeIds.length ? selectedNodeIds[0] : ROOT_NODE_ID;

    var firstNode = tagTree.get_node(firstNodeId);
    if (firstNode.type == 'default') {
        firstNode.state.opened = true;
    } else {
        firstNodeId = tagTree.get_node(firstNode).parent;
    }

    if ($('#create_folder_for_tag').is(':checked')) {
        firstNodeId = tagTree.create_node(firstNodeId,
            {"id" : "", "type" : "default", "text" : (nodeName == null ? "New Folder" : nodeName), "opened" : true});
    }

    if (nodeName == null) {
        newNodeId = tagTree.create_node(firstNodeId, {"id" : "", "type" : "file", "text" : "New Tag", "opened" : true});
        tagTree.edit(newNodeId);
    } else {
        tagTree.create_node(firstNodeId, {"id" : "", "type" : "file", "text" : nodeName});
    }
};

function jstree_node_rename() {
	var tagTree = $('#tagTree').jstree();
    var selectedNodeIds = tagTree.get_selected();
	if (!selectedNodeIds.length) {
        return false;
    }

	tagTree.edit(selectedNodeIds[0]);
};

function jstree_node_delete() {
	var tagTree = $('#tagTree').jstree();
    var selectedNodeIds = tagTree.get_selected();
	if (!selectedNodeIds.length) {
        return false;
    }

	var firstNodeId = selectedNodeIds[0];
    if (firstNodeId == ROOT_NODE_ID) {
        return false;
    }

    var firstNode = tagTree.get_node(firstNodeId);
    if (firstNode.type == 'default' && firstNode.children.length > 0) {
        if (!(confirm('Are you sure you want to delete this folder and all subfolders and bookmarks within it?'))) {
            return false;
        }
    }

	tagTree.delete_node(firstNodeId);
};


/****************************************
 GET/SET AND VERIFICATION FOR API TOKEN
*****************************************/

function validateApiTokenAndLoadTags() {
    chrome.storage.local.get('api_token', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to retrieve API token from storage:\n\n" + chrome.runtime.lastError.message);
        }
        if (result != undefined && result.api_token != undefined) {
            $("#apiToken").val(result.api_token);
            verifyApiTokenAndLoadTags(result.api_token);
        } else {
            setApiTokenValidityIcon(false);
            $("#helpBox").show('drop', { direction: "right" }, 300);
            enableInputElements();
        }
    });
}

function verifyApiTokenAndLoadTags(apiToken) {
    var client = new XMLHttpRequest();
    client.open("GET", 'https://api.pinboard.in/v1/user/api_token?format=json&auth_token=' + apiToken);
    client.onload = function(e) {
        $("#tagContainer").empty();
        setApiTokenValidityIcon(client.status == 200);
        chrome.storage.local.set({'api_token': apiToken}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save API token to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
        });
        if (client.status == 200) {
            retrieveAndDisplayAllTags(apiToken);
        } else {
            logInvalidResponse('/user/api_token', client, false);
        }
    };
    client.onerror = function(e) {
        throw e;
    };
    if ($.trim($("#apiToken").val()) != '') {
        disableInputElements("Verifying API Token");
        client.send();
    }
}

function setApiTokenValidityIcon(isTokenValid) {
    var ind = document.getElementById('apiTokenStatusIndicator');
    if (isTokenValid) {
        ind.src = 'images/api-token-valid.svg';
        ind.title = 'Valid Auth Token';
    } else {
        ind.src = 'images/api-token-invalid.svg';
        ind.title = 'Invalid Auth Token';
    }
}

/****************************
 ERROR HANDLING AND LOGGING
*****************************/

function logInvalidResponse(action, client, showPopup = true) {
    var errorMessage = 'Call to ' + action + ' failed with response: ' + client.status + ' ' + client.statusText;
    console.error(errorMessage);
    if (showPopup)
        alert(errorMessage);
    enableInputElements();
}

function logError(message, showPopup = true) {
    console.error(message);
    if (showPopup)
        alert(message);
    enableInputElements();
}

window.onerror = function(messageOrEvent, sourceUrl, lineNo, columnNo, error) {
    var errorMessage = 'An error occurred on "' + sourceUrl + '[' + lineNo + ':' + columnNo + ']": ' + messageOrEvent;
    console.error(errorMessage);
    if (error != null && error.stack != undefined) {
        console.error('Stack trace: ' + error.stack);
    }
    alert(errorMessage);
    enableInputElements();
    return false;
}


/***************************************************************
 GET BOOKMARK DATA FROM PINBOARD AND LOCAL BOOKMARK GENERATION
****************************************************************/

function getAllPostsAndGenerateBookmarks() {
    if (allBookmarks == undefined) {
        getAllPostsFromPinboard();
    } else {
        chrome.storage.local.get('local_bookmarks_last_updated', function(result) {
            if (chrome.runtime.lastError) {
                logError("Unable to determine last bookmarks retrieval date:\n\n" + chrome.runtime.lastError.message);
            }
            if (result == undefined || result.local_bookmarks_last_updated == undefined) {
                getAllPostsFromPinboard();
            } else {
                var isTooSoonToGetAllPosts = ((Date.now() - result.local_bookmarks_last_updated) / 1000) < ALL_POSTS_REQUEST_LIMIT_IN_SEC;
                if (isTooSoonToGetAllPosts) {
                    generateBookmarks();
                } else {
                    chrome.storage.local.get('api_token', function(api_token_result) {
                        if (chrome.runtime.lastError) {
                            logError("Unable to retrieve API token from storage:\n\n" + chrome.runtime.lastError.message);
                        } else if (api_token_result != undefined && api_token_result.api_token != undefined) {
                            var client = new XMLHttpRequest();
                            client.open("GET", 'https://api.pinboard.in/v1/posts/update?format=json&auth_token=' + api_token_result.api_token);
                            client.onload = function(e) {
                                if (client.status == 200) {
                                    var lastRemoteUpdateTime = Date.parse(JSON.parse(client.responseText)['update_time']);
                                    if (result.local_bookmarks_last_updated >= lastRemoteUpdateTime) {
                                        generateBookmarks();
                                    } else {
                                        getAllPostsFromPinboard();
                                    }
                                } else {
                                    logInvalidResponse('/posts/update', client);
                                }
                            };
                            client.onerror = function(e) {
                                throw e;
                            };
                            client.send();
                        } else {
                            logError('API token is missing.\n\nUnable to get bookmarks from Pinboard.');
                        }
                    });
                }
            }
        });
    }
}

function getAllPostsFromPinboard() {
    chrome.storage.local.get('api_token', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to retrieve API token from storage:\n\n" + chrome.runtime.lastError.message);
        } else if (result != undefined && result.api_token != undefined) {
            var client = new XMLHttpRequest();
            client.open("GET", 'https://api.pinboard.in/v1/posts/all?format=json&auth_token=' + result.api_token);
            client.onload = function(e) {
                if (client.status == 200) {
                    var rawdata = JSON.parse(client.responseText);
                    var data = [];
                    rawdata.forEach(function(url) {
                        var o = new Object();
                        o.href = url['href'];
                        o.description = url['description'];
                        o.tags = [];
                        url['tags'].split(' ').forEach(function(tag) {
                            o.tags.push(he.decode(tag).toLowerCase());
                        });
                        data.push(o);
                    });
                    allBookmarks = data;
                    chrome.storage.local.set({'local_bookmarks_last_updated': Date.now()}, function() {
                        if (chrome.runtime.lastError) {
                            logError("Unable to save last full-bookmarks retrieval date to storage:\n\n" + chrome.runtime.lastError.message, false);
                        }
                    });
                    generateBookmarks();
                } else {
                    logInvalidResponse('/posts/all', client);
                }
            };
            client.onerror = function(e) {
                throw e;
            };
            client.send();
        } else {
            logError('API token is missing.\n\nUnable to get bookmarks from Pinboard.');
        }
    });
}

function generateBookmarks() {
    chrome.bookmarks.getChildren("0", function(children) {
        var isBarFound = false;
        for (var i = 0; i < children.length; i++) {
            if (children[i].title.toUpperCase() === 'BOOKMARKS BAR') {
                isBarFound = true;
                var relevantUrls = filterBookmarksToSelectedTags();
                var topTagNode = getSelectedTagDataJson();
                var ignoreDelimiters = $('#ignore_tag_delimiters').is(':checked');

                if ($("#attempt_to_delete_previous_folder").is(':checked')) {
                    rootBookmarkIds.forEach(function(oldBookmarkId) {
                        chrome.bookmarks.removeTree(oldBookmarkId);
                    });
                }
                rootBookmarkIds.length = 0;

                if ($('#add_directly_to_bookmarks_bar').is(':checked')) {
                    createPageOrFolder(children[i].id, topTagNode[0]['children'], relevantUrls, ignoreDelimiters, true);
                } else {
                    createPageOrFolder(children[i].id, topTagNode, relevantUrls, ignoreDelimiters, true);
                }
                enableInputElements();
                break;
            }
        }
        if (isBarFound == false) {
            logError('Cannot add bookmarks. Unable to find the "Bookmarks Bar" in your browser.');
        }
    });
}

function filterBookmarksToSelectedTags() {
    var distinctTagNames = getDistinctTagNames();
    var relevantUrls = [];
    var ignoreDelimiters = $('#ignore_tag_delimiters').is(':checked');
    distinctTagNames.forEach(function(tagName) {
        allBookmarks.forEach(function(url) {
            if (!ignoreDelimiters) {
                if (tagName.indexOf(tagLogicalAndDelimiter) > -1) {
                    var tagNodeNames = tagName.split(tagLogicalAndDelimiter)
                                              .filter(function(s) {return s.length != 0});
                } else if (tagName.indexOf(tagLogicalOrDelimiter) > -1) {
                    var tagNodeNames = tagName.split(tagLogicalOrDelimiter)
                                              .filter(function(s) {return s.length != 0});
                }
            }

            if (tagNodeNames == undefined) {
                if (url.tags.indexOf(tagName) != -1 && relevantUrls.indexOf(url) == -1) {
                    relevantUrls.push(url);
                }
            } else {
                tagNodeNames.forEach(function(tagNodeName) {
                    if (url.tags.indexOf(tagNodeName) != -1 && relevantUrls.indexOf(url) == -1) {
                        relevantUrls.push(url);
                    }
                });
            }
        })
    })
    return relevantUrls;
}

function createPageOrFolder(parentNodeId, tagNode, urls, ignoreDelimiters, storeRootId = false) {
    tagNode.forEach(function(tag) {
        if (tag['type'] == 'default') {
            chrome.bookmarks.create({'parentId': parentNodeId,
                                     'title': tag['text']},
                                     function(newFolder) {
                                         if (storeRootId) {
                                             storeRootBookmarkId(newFolder.id);
                                         }
                                         createPageOrFolder(newFolder.id, tag['children'], urls, ignoreDelimiters);
                                     });
        } else {
            urls.forEach(function(url) {
                var tagNodeName = tag['text'];
                if (!ignoreDelimiters) {
                    if (tagNodeName.indexOf(tagLogicalAndDelimiter) > -1) {
                        var tagNodeNames = tagNodeName.split(tagLogicalAndDelimiter)
                                                      .filter(function(s) {return s.length != 0});
                        var comparison = "AND";
                    } else if (tagNodeName.indexOf(tagLogicalOrDelimiter) > -1) {
                        var tagNodeNames = tagNodeName.split(tagLogicalOrDelimiter)
                                                      .filter(function(s) {return s.length != 0});
                        var comparison = "OR";
                    }
                }

                if (tagNodeNames == undefined) {
                    if (url['tags'].indexOf(tagNodeName.toLowerCase()) != -1) {
                        chrome.bookmarks.create({'parentId': parentNodeId,
                                                 'title': url['description'],
                                                 'url': url['href']},
                                                function(newBookmark) {
                                                    if (storeRootId) {
                                                        storeRootBookmarkId(newBookmark.id);
                                                    }
                                                });
                    }
                } else if (comparison == "OR") {
                    if (tagNodeNames.some(x => url['tags'].indexOf(x.toLowerCase()) != -1)) {
                        chrome.bookmarks.create({'parentId': parentNodeId,
                                                 'title': url['description'],
                                                 'url': url['href']},
                                                function(newBookmark) {
                                                    if (storeRootId) {
                                                        storeRootBookmarkId(newBookmark.id);
                                                    }
                                                });
                    }
                } else if (comparison == "AND") {  // comparison is AND
                    if (tagNodeNames.every(x => url['tags'].indexOf(x.toLowerCase()) != -1)) {
                        chrome.bookmarks.create({'parentId': parentNodeId,
                                                 'title': url['description'],
                                                 'url': url['href']},
                                                function(newBookmark) {
                                                    if (storeRootId) {
                                                        storeRootBookmarkId(newBookmark.id);
                                                    }
                                                });
                    }
                }
            });
        }
    });
}

function storeRootBookmarkId(rootBookmarkId) {
     rootBookmarkIds.push(rootBookmarkId);
     chrome.storage.local.set({'root_bookmark_ids': rootBookmarkIds});
}


/*******************
 HANDLE USER INPUT
********************/

function preventInvalidOperatorFromUser(event) {
    var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
    if (key == ' ' || key == ',') {
        event.preventDefault();
        return false;
    }
}

function applyTagListFilter() {
    var tags = $('.tag');
    $('#searchFilter').on('input', function() {
        var regex = new RegExp('\\b' + this.value, "i");
        var tagsToShow = tags.filter(function() {
            return regex.test($(this).text());
        });
        tags.not(tagsToShow).hide();
        tagsToShow.show();
    });
}


/*********************
 EVENT SUBSCRIPTIONS
**********************/

function subscribeEvents() {
    $("#verifyApiToken").on("click", function() {
        verifyApiTokenAndLoadTags($("#apiToken").val());
        $('#searchFilter').val('');
    });

    $("#generateBookmarks").on('click', function() {
        disableInputElements("Generating Bookmarks... this may take a minute");
        chrome.storage.local.set({'selected_tags': $('#tagTree').jstree(true).get_json('#')}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save your selected tags to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
            getAllPostsAndGenerateBookmarks();
        });
    });

    $("#saveTags").on('click', function() {
        chrome.storage.local.set({'selected_tags': $('#tagTree').jstree(true).get_json('#')}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save your selected tags to storage:\n\n" + chrome.runtime.lastError.message);
            }
        });
    });

    $("#help").on('click', function() {
        $("#settingsBox").hide('drop', { direction: "right" }, 100);
        $("#helpBox").toggle('drop', { direction: "right" }, 300);
    });

    $("#closeHelpBox").on('click', function() {
        $("#helpBox").hide('drop', { direction: "right" }, 300);
    });

    $("#settings").on('click', function() {
        $("#helpBox").hide('drop', { direction: "right" }, 100);
        $("#settingsBox").toggle('drop', { direction: "right" }, 300);
    });

    $("#closeSettingsBox").on('click', function() {
        $("#settingsBox").hide('drop', { direction: "right" }, 300);
    });

    $("#create_folder_for_tag").on('click', function() {
        chrome.storage.local.set({'create_folder_for_tag': $('#create_folder_for_tag').is(':checked')}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save create_folder_for_tag option to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
        });
    });

    $("#add_directly_to_bookmarks_bar").on('click', function() {
        chrome.storage.local.set({'add_directly_to_bookmarks_bar': $('#add_directly_to_bookmarks_bar').is(':checked')}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save add_directly_to_bookmarks_bar option to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
        });
    });

    $("#confirm_before_deleting_folder").on('click', function() {
        chrome.storage.local.set({'confirm_before_deleting_folder': $('#confirm_before_deleting_folder').is(':checked')}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save confirm_before_deleting_folder option to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
        });
    });

    $("#attempt_to_delete_previous_folder").on('click', function() {
        chrome.storage.local.set({'attempt_to_delete_previous_folder': $('#attempt_to_delete_previous_folder').is(':checked')}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save attempt_to_delete_previous_folder option to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
        });
    });

    $("#ignore_tag_delimiters").on('click', function() {
        var ignoreDelimiters = $('#ignore_tag_delimiters').is(':checked');
        chrome.storage.local.set({'ignore_tag_delimiters': ignoreDelimiters}, function() {
            if (chrome.runtime.lastError) {
                logError("Unable to save ignore_tag_delimiters option to storage:\n\n" + chrome.runtime.lastError.message, false);
            }
        });
        $("#desired_and_operator").prop('disabled', ignoreDelimiters);
        $("#desired_or_operator").prop('disabled', ignoreDelimiters);
        $("#desired_and_operator_label").css("color", ignoreDelimiters ? DISABLED_TEXT_COLOR : ENABLED_TEXT_COLOR);
        $("#desired_or_operator_label").css("color", ignoreDelimiters ? DISABLED_TEXT_COLOR : ENABLED_TEXT_COLOR);
    });

    $("#desired_and_operator").on('input', function() {
        var userInput = $('#desired_and_operator').val();
        if (userInput.length == 1 && userInput != ' ' && userInput != ',') {
            chrome.storage.local.set({'desired_and_operator': userInput}, function() {
                if (chrome.runtime.lastError) {
                    logError("Unable to save desired_and_operator option to storage:\n\n" + chrome.runtime.lastError.message, false);
                }
            });
            tagLogicalAndDelimiter = userInput;
        }
    });

    $('#desired_and_operator').on('keypress', function (event) {
        preventInvalidOperatorFromUser(event);
    });

    $("#desired_or_operator").on('input', function() {
        var userInput = $('#desired_or_operator').val();
        if (userInput.length == 1 && userInput != ' ' && userInput != ',') {
            chrome.storage.local.set({'desired_or_operator': userInput}, function() {
                if (chrome.runtime.lastError) {
                    logError("Unable to save desired_or_operator option to storage:\n\n" + chrome.runtime.lastError.message, false);
                }
            });
            tagLogicalOrDelimiter = userInput;
        }
    });

    $('#desired_or_operator').on('keypress', function (event) {
        preventInvalidOperatorFromUser(event);
    });

    $("#deleteSelectedTags").on('click', function() {
        if (confirm('This will delete all selected tags in the treeview.\n\nContinue?')) {
            chrome.storage.local.set({'selected_tags': [{"id":ROOT_NODE_ID, "text":"Pinboard", "icon":"images/root.gif"}]}, function() {
                if (chrome.runtime.lastError) {
                    logError("Unable to clear selected tags:\n\n" + chrome.runtime.lastError.message);
                } else {
                    // $('#tagTree').jstree(true).core.data = [{"id":ROOT_NODE_ID, "text":"Pinboard", "icon":"images/root.gif"}]
                    // generateTagTree([{"id":ROOT_NODE_ID, "text":"Pinboard", "icon":"images/root.gif"}]);
                    // $("#tagTree").load(location.href + " #tagTree>*", "");
                    window.location.reload();
                }
            });
        }
    });

    $("#deleteAllCache").on('click', function() {
        if (confirm('This will delete all stored data for this extension.\n\nContinue?')) {
            chrome.storage.local.clear(function() {
                if (chrome.runtime.lastError) {
                    logError("Unable to clear local storage:\n\n" + chrome.runtime.lastError.message);
                } else {
                    window.location.reload();
                }
            });
        }
    });
}

function loadSettingsFromStorage() {
    chrome.storage.local.get('create_folder_for_tag', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load create_folder_for_tag option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        $('#create_folder_for_tag').attr('checked',
            result != undefined && result.create_folder_for_tag != undefined && result.create_folder_for_tag);
    });

    chrome.storage.local.get('add_directly_to_bookmarks_bar', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load add_directly_to_bookmarks_bar option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        $('#add_directly_to_bookmarks_bar').attr('checked',
            result != undefined && result.add_directly_to_bookmarks_bar != undefined && result.add_directly_to_bookmarks_bar);
    });

    chrome.storage.local.get('confirm_before_deleting_folder', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load confirm_before_deleting_folder option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        var initializeSetting = (result == undefined || result.confirm_before_deleting_folder == undefined);
        $('#confirm_before_deleting_folder').attr('checked',
             initializeSetting ? true : result.confirm_before_deleting_folder);
    });

    chrome.storage.local.get('attempt_to_delete_previous_folder', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load attempt_to_delete_previous_folder option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        $('#attempt_to_delete_previous_folder').attr('checked',
            result != undefined && result.attempt_to_delete_previous_folder != undefined && result.attempt_to_delete_previous_folder);
    });

    chrome.storage.local.get('ignore_tag_delimiters', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load ignore_tag_delimiters option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        var ignoreDelimiters = result != undefined && result.ignore_tag_delimiters != undefined && result.ignore_tag_delimiters;
        $('#ignore_tag_delimiters').attr('checked', ignoreDelimiters);
        $("#desired_and_operator").prop('disabled', ignoreDelimiters);
        $("#desired_or_operator").prop('disabled', ignoreDelimiters);
        $("#desired_and_operator_label").css("color", ignoreDelimiters ? DISABLED_TEXT_COLOR : ENABLED_TEXT_COLOR);
        $("#desired_or_operator_label").css("color", ignoreDelimiters ? DISABLED_TEXT_COLOR : ENABLED_TEXT_COLOR);
    });

    chrome.storage.local.get('desired_and_operator', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load desired_and_operator option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        if (result != undefined && result.desired_and_operator != undefined
            && result.desired_and_operator != "," && result.desired_and_operator != " ") {
            tagLogicalAndDelimiter = result.desired_and_operator;
        } else {
            tagLogicalAndDelimiter = DEFAULT_AND_DELIMITER;
        }
        $('#desired_and_operator').val(tagLogicalAndDelimiter);
    });

    chrome.storage.local.get('desired_or_operator', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to load your option from storage:\n\n" + chrome.runtime.lastError.message, false);
        }
        if (result != undefined && result.desired_or_operator != undefined
            && result.desired_or_operator != "," && result.desired_or_operator != " ") {
            tagLogicalOrDelimiter = result.desired_or_operator;
        } else {
            tagLogicalOrDelimiter = DEFAULT_OR_DELIMITER;
        }
        $('#desired_or_operator').val(tagLogicalOrDelimiter);
    });

    chrome.storage.local.get('root_bookmark_ids', function(result) {
        if (chrome.runtime.lastError) {
            logError("Unable to retrieve root_bookmark_ids from storage:\n\n" + chrome.runtime.lastError.message, false);
        }

        if (result != undefined && result.root_bookmark_ids != undefined) {
            rootBookmarkIds = result.root_bookmark_ids;
        } else {
            rootBookmarkIds = [];
        }
    });

    loadSelectedTagsFromStorage();
}

window.addEventListener('load', function load(event) {
    disableInputElements("Initializing");
    loadSettingsFromStorage();
    validateApiTokenAndLoadTags();
    subscribeEvents();
});
