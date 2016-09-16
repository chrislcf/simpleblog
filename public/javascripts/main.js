var renderPreview = function () {
  $('#preview').html(marked($('#content').val()));
};

$('#generate').click(function () {
  $.post('/scrypt', {
    password: $('#password').val()
  }, function (data) {
    prompt('Please copy and paste into config.json, then restart npm', data.hash);
  });
});

$('#content').keyup(renderPreview);

(function ($) {
  $.fn.enableSmartTab = function () {
    var $this;
    $this = $(this);
    $this.keydown(function (e) {
      var after, before, end, lastNewLine, changeLength, re, replace, selection, start, val;
      if (e.keyCode === 9 && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        start = this.selectionStart;
        end = this.selectionEnd;
        val = $this.val();
        before = val.substring(0, start);
        after = val.substring(end);
        replace = true;
        if (start !== end) {
          selection = val.substring(start, end);
          if (~selection.indexOf('\n')) {
            replace = false;
            changeLength = 0;
            lastNewLine = before.lastIndexOf('\n');
            if (!~lastNewLine) {
              selection = before + selection;
              changeLength = before.length;
              before = '';
            } else {
              selection = before.substring(lastNewLine) + selection;
              changeLength = before.length - lastNewLine;
              before = before.substring(0, lastNewLine);
            }
            if (e.shiftKey) {
              re = /(\n|^)(\t|[ ]{1,8})/g;
              if (selection.match(re)) {
                start--;
                changeLength--;
              }
              selection = selection.replace(re, '$1');
            } else {
              selection = selection.replace(/(\n|^)/g, '$1\t');
              start++;
              changeLength++;
            }
            $this.val(before + selection + after);
            this.selectionStart = start;
            this.selectionEnd = start + selection.length - changeLength;
          }
        }
        if (replace && !e.shiftKey) {
          $this.val(before + '\t' + after);
          this.selectionStart = this.selectionEnd = start + 1;
        }
      }
    });
  };
})(jQuery);

$(function () {
  $("textarea").enableSmartTab();
  renderPreview();
});
