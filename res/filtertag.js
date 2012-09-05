window.onload = window.onhashchange = filterList;

function getTags() {
  var tags = document.location.hash.slice(1).split(",");
  if (!tags[0].length) tags.pop();
  return tags;
}

function filterList() {
  var tags = getTags(), posts = document.body.getElementsByClassName("post");
  for (var i = 0; i < posts.length; ++i) {
    var post = posts[i], visible = true;
    var ptags = post.getAttribute("data-tags").split(",");
    for (var j = 0; j < tags.length; ++j)
      if (ptags.indexOf(tags[j]) == -1) visible = false;
    post.style.display = visible ? "" : "none";
  }
  var tagElts = document.body.getElementsByClassName("tag");
  for (var i = 0; i < tagElts.length; ++i) {
    var elt = tagElts[i];
    elt.className = "tag" + (tags.indexOf(elt.textContent) > -1 ? " selected" : "");
  }
}

function filterTag(tag) {
  var tags = getTags(), known = tags.indexOf(tag);
  if (known == -1) tags.push(tag);
  else tags.splice(known, 1);
  document.location.hash = tags.length ? "#" + tags.join(",") : "";
}
