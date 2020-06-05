//<script>

/* returns a jquery deferred object, .done() means an invite was sent (or attempted), .fail() indicates they dismissed the modal */
function PresentGroupInviteOptions( rgFriendsToInvite )
{
	// this deferred will succeed if an invite is succesfully sent, fail if the user dismisses the modal or the invite AJAX fails
	var deferred = new jQuery.Deferred();

	var Modal = ShowDialog( '邀請加入您的群組', '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'newmodal_content_innerbg'} );

	var bBulkFriendInvite = false;
	var steamIDInvitee = g_rgProfileData['steamid'];
	var strProfileURL = g_rgProfileData['url'];

	// see if this is a request to bulk invite a group of friends
	if ( rgFriendsToInvite && rgFriendsToInvite instanceof Array )
	{
		if ( rgFriendsToInvite.length == 1 )
		{
			steamIDInvitee = rgFriendsToInvite[0];
			strProfileURL = 'https://steamcommunity.com/profiles/' + steamIDInvitee + '/';
		}
		else
		{
			// true bulk invite
			steamIDInvitee = rgFriendsToInvite;
			bBulkFriendInvite = true;
		}
	}

	// if the modal is dismissed , we'll cancel the deferred object.  We capture this in a closure so that we can dismiss the modal without affecting
	//	the deferred object if the user actually picks something (in which case the deferred object will be the success of the AJAX invite action)
	var fnOnModalDismiss = function() { deferred.reject() };

	$J.get( strProfileURL + 'ajaxgroupinvite?new_profile=1' + ( bBulkFriendInvite ? '&bulk=1' : '' ), function( html ) {
		Modal.GetContent().find( '.newmodal_content').html('');	// erase the throbber
		Modal.GetContent().find( '.newmodal_content').append( $ListElement );
		$ListElement.html( html );
		Modal.AdjustSizing();
		$ListElement.children( '.group_list_results' ).children().each( function () {
			var groupid = this.getAttribute( 'data-groupid' );
			if ( groupid )
			{
				$J(this).click( function() {
					fnOnModalDismiss = function () {;};	// don't resolve the deferred on modal dismiss anymore, user has picked something
					InviteUserToGroup( Modal, groupid, steamIDInvitee)
					.done( function() { deferred.resolve(); } )
					.fail( function() { deferred.reject(); } );
				} );
			}
		});
	});

	Modal.done( function() {fnOnModalDismiss();} );

	return deferred.promise();
}

function InviteUserToGroup( Modal, groupID, steamIDInvitee )
{
	var params = {
		json: 1,
		type: 'groupInvite',
		group: groupID,
		sessionID: g_sessionID
	};

	if ( !steamIDInvitee.length )
	{
		ShowAlertDialog( '錯誤', '您尚未選擇任何好友。' );
		return;
	}

	if ( steamIDInvitee instanceof Array )
		params.invitee_list = V_ToJSON( steamIDInvitee );
	else
		params.invitee = steamIDInvitee;

	return $J.ajax( { url: 'https://steamcommunity.com/actions/GroupInvite',
		data: params,
		type: 'POST'
	} ).done( function( data ) {
		Modal && Modal.Dismiss();

		var strMessage = '已發送邀請！';
		if ( steamIDInvitee instanceof Array && steamIDInvitee.length > 1 )
			strMessage = '已發送邀請！';

		ShowAlertDialog( '邀請加入您的群組', strMessage );
	}).fail( function( data ) {
		Modal && Modal.Dismiss();

		var rgResults = data.responseJSON;

		var strModalTitle = '群組邀請失敗';
        var strAccountListModal = '<div class="ctnClanInviteErrors">';
        strAccountListModal += rgResults.results ? rgResults.results : '處理您的請求時發生錯誤。請再試一次。';
		if ( rgResults.rgAccounts )
		{
			strAccountListModal += '<div class="ctnClanInviteErrors"><table class="clanInviteErrorTable" ><thead><tr><th class="inviteTablePersona" >已邀請的玩家</th><th class="inviteTableError">錯誤</th></tr></thead><tbody>';
			var cAccounts = 0;
			$J.each( rgResults.rgAccounts, function( accountid, rgError ){
				strAccountListModal += '<tr>';
				strAccountListModal += '<td class="inviteTablePersona ellipsis">' + rgError.persona + '</td>';
				strAccountListModal += '<td class="inviteTableError">' + rgError.strError + "</td>";
				strAccountListModal += '</tr>';

                if ( typeof SelectNone != 'undefined' )
                {
	                SelectNone();
	                $J( '#fr_' + accountid ).addClass( 'groupInviteFailed' );
                }

				cAccounts++;
			} );
			strAccountListModal += '</tbody></table>';

            if ( cAccounts > 1 )
	            strModalTitle = '群組邀請失敗';

		}
		strAccountListModal +='</div>';
		ShowAlertDialog( strModalTitle, strAccountListModal );
	});
}

function RemoveFriend()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( '移除好友',
		'您確定要從您的好友名單移除 %s 嗎？'.replace( /%s/, strPersonaName ),
		'移除好友'
	).done( function() {
		$J.post(
			'https://steamcommunity.com/actions/RemoveFriendAjax',
			{sessionID: g_sessionID, steamid: steamid }
		).done( function() {
			ShowAlertDialog( '移除好友',
				'%s 已經從您的好友名單中移除。'.replace( /%s/, strPersonaName )
			).done( function() {
				// reload the page when they click OK, so we update friend state
				window.location.reload();
			} );
		} ).fail( function() {
			ShowAlertDialog( '移除好友',
				'處理您的請求時發生錯誤。請再試一次。'
			);
		} );
	} );
}

function CancelInvite()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( '取消邀請',
	'您確定要取消好友邀請嗎？<br>短時間內您將無法再次傳送邀請給這位玩家。如果你們互相認識，您可以隨時傳送<a href="https://steamcommunity.com/my/friends/add" target="_blank" rel="noreferrer">好友邀請連結</a>給他們。',
	'取消邀請'
	).done( function() {
		$J.post(
			'https://steamcommunity.com/actions/RemoveFriendAjax',
			{sessionID: g_sessionID, steamid: steamid }
		).done( function() {
			ShowAlertDialog( '取消邀請',
				'您傳送給 %s 的邀請已經取消。'.replace( /%s/, strPersonaName )
		).done( function() {
				// reload the page when they click OK, so we update friend state
				window.location.reload();
			} );
		} ).fail( function() {
			ShowAlertDialog( '取消邀請',
				'處理您的請求時發生錯誤。請再試一次。'
		);
		} );
	} );
}

// also used for accepting friend invites
function AddFriend( bRespondingToInvite, steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'https://steamcommunity.com/actions/AddFriendAjax',
		{sessionID: g_sessionID, steamid: steamid, accept_invite: bRespondingToInvite ? 1 : 0 }
	).done( function() {
		if ( !bRespondingToInvite )
		{
			ShowAlertDialog( '新增好友' + ' - ' + strPersonaName,
				'已送出好友邀請。對方接受邀請後將顯示於您的好友名單中。'
			).done( function() { window.location.reload(); } );
		}
		else
		{
			ShowAlertDialog( '接受好友請求',
				'好友請求已接受'
			).done( function() { window.location.reload(); } );
		}
	} ).fail( function( jqXHR  ) {

		var failedInvites = jqXHR.responseJSON['failed_invites_result'];

		if ( failedInvites === undefined )
		{
			ShowAlertDialog( '新增好友',
				'新增好友時發生錯誤。請再試一次。'
			);
			return;
		}

		// defaults
		var strTitle = '新增好友';
		var strMessage = '新增好友時發生錯誤。請再試一次。';

		switch ( failedInvites[0] )
		{
			case 25:
				strMessage = '無法邀請 %s，您的好友名單已滿。';
				break;

			case 15:
				strMessage = '無法邀請 %s，他們的好友名單已滿。';
				break;

			case 40:
				strMessage = '無法新增此人為好友。您和該用戶之間的通訊已被封鎖。';
				break;

			case 11:
				strMessage = '您正封鎖與這位使用者通訊的所有管道。在和他們通訊前，請先前往其 Steam 社群頁面以解除對他們的封鎖。';
				break;

			case 84:
				strMessage = '看來您最近發送了太多好友邀請。為了避免濫發邀請，您必須等待一段時間後才可邀請更多好友。請注意，其他玩家在這段時間內仍可將您加為好友。';
				break;

			case 24:
				strMessage = '您的 Steam 帳戶並未達到使用此功能的需求。 <a class="whiteLink" href="https://help.steampowered.com/zh-tw/wizard/HelpWithLimitedAccount" target="_blank" rel="noreferrer">造訪 Steam 客服網站</a>了解更多訊息。';
				break;

			default:
				// default text is above
				break;
		}

		strMessage = strMessage.replace( /%s/, strPersonaName );
		ShowAlertDialog( strTitle, strMessage );

	} );
}

// ignore an invite; do not block the inviter
function IgnoreFriendInvite( steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'https://steamcommunity.com/actions/IgnoreFriendInviteAjax',
		{sessionID: g_sessionID, steamid: steamid }
	).done( function() {
		ShowAlertDialog( '忽略好友邀請',
			'好友請求已忽略'
		).done( function() { window.location.reload(); } );
	} ).fail( function() {
		ShowAlertDialog( '忽略好友邀請',
			'忽略好友請求發生錯誤。請再重試一次。'
		);
	} );
}

// block a user, with confirmation
function ConfirmBlock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( '封鎖所有通訊',
		'您正要封鎖與 %s 之間的所有通訊。'.replace( /%s/, strPersonaName ),
		'是的，封鎖他們'
	).done( function() {
			$J.post(
				'https://steamcommunity.com/actions/BlockUserAjax',
				{sessionID: g_sessionID, steamid: steamid, block: 1 }
			).done( function() {
				ShowAlertDialog( '封鎖所有通訊',
					'您已封鎖與該玩家之間的所有通訊。'
				).done( function() {
					location.reload();
				} );
			} ).fail( function() {
				ShowAlertDialog( '封鎖所有通訊',
					'處理您的請求時發生錯誤。請再試一次。'
				);
			} );
		} );
}

// unblock a user, with confirmation
function ConfirmUnblock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( '解除封鎖所有通訊',
	'您正要解鎖與 %s 之間的所有通訊。'.replace( /%s/, strPersonaName ),
	'是的，將他們解除封鎖'
).done( function() {
	$J.post(
		'https://steamcommunity.com/actions/BlockUserAjax',
		{sessionID: g_sessionID, steamid: steamid, block: 0 }
	).done( function() {
		ShowAlertDialog( '解除封鎖所有通訊',
			'您已解鎖與該玩家之間的所有通訊。'
		).done( function() {
			location.reload();
		} );
	} ).fail( function() {
		ShowAlertDialog( '解除封鎖所有通訊',
			'處理您的請求時發生錯誤。請再試一次。'
		);
	} );
} );
}

function InitProfileSummary( strSummary )
{
	var $Summary = $J( '.profile_summary' );
	var $SummaryFooter = $J( '.profile_summary_footer' );

	if ( $Summary[0].scrollHeight <= 76 )
	{
		$Summary.addClass( 'noexpand' );
		$SummaryFooter.hide();
	}
	else
	{
		var $ModalSummary = $J('<div/>', {'class': 'profile_summary_modal'}).html( strSummary );
		$SummaryFooter.find( 'span' ).click( function() {
			var Modal = ShowDialog( '資訊', $ModalSummary );
			window.setTimeout( function() { Modal.AdjustSizing(); }, 1 );
		} );
	}

}

function ShowFriendsInCommon( unAccountIDTarget )
{
	ShowPlayerList( '共同的好友', 'friendsincommon', unAccountIDTarget );
}

function ShowFriendsInGroup( unClanIDTarget )
{
	ShowPlayerList( '群組中的好友', 'friendsingroup', unClanIDTarget );
}

function ShowPlayerList( title, type, unAccountIDTarget, rgAccountIDs )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {};
	if ( type )
		rgParams['type'] = type;
	if ( unAccountIDTarget )
		rgParams['target'] = unAccountIDTarget;
	if ( rgAccountIDs )
		rgParams['accountids'] = rgAccountIDs.join( ',' );

	$J.get( 'https://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
		$ListElement.append();
	});
}

function ToggleManageFriends()
{
	if ( $J('#manage_friends_actions_ctn').is( ':hidden' ) )
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'down').addClass( 'up' );
		$J('#manage_friends_actions_ctn').slideDown( 'fast' );
		$J('div.manage_friend_checkbox').show();
		$J('a.friendBlockLinkOverlay' ).on( 'click.manage_friends', function( event ) {
			if ( !event.which || event.which == 1 )
			{
				event.preventDefault();
				$J(this ).siblings('.manage_friend_checkbox' ).find('input[type=checkbox]' ).prop( 'checked', function( i, v ) { return !v; } );
			}
		});
	}
	else
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'up').addClass( 'down' );
		$J('#manage_friends_actions_ctn').slideUp( 'fast' );
		$J('div.manage_friend_checkbox').hide();
		$J('a.friendBlockLinkOverlay' ).off( 'click.manage_friends' );
	}
}

function ManageFriendsInviteToGroup( $Form, groupid )
{
	$Form.find('input[type="checkbox"]');
	var rgFriendSteamIDs = [];
	$Form.find( 'input[type=checkbox]' ).each( function() {
		if ( this.checked )
			rgFriendSteamIDs.push( $J(this).attr( 'data-steamid' ) );
	} );
	if ( rgFriendSteamIDs.length > 0 )
	{
		if ( groupid )
		{
			// specific group
			InviteUserToGroup( null /* no modal window */, groupid, rgFriendSteamIDs ).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
		else
		{
			// ask the user which group to invite to
			PresentGroupInviteOptions( rgFriendSteamIDs).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
	}
	else
	{
		ShowAlertDialog( '邀請加入您的群組', '您尚未選擇任何好友。' );
	}
}

function ManageFriendsExecuteBulkAction( $Form, strActionName )
{
	if ( $Form.find('input[type=checkbox]:checked').length == 0 )
	{
		ShowAlertDialog( '', '您尚未選擇任何好友。' );
		return;
	}

	$Form.find('input[name=action]').val( strActionName );
	$Form.submit();
}

function ManageFriendsConfirmBulkAction( $Form, strActionName, strTitle, strSingluarDescription, strPluralDescription )
{
	var cFriendsSelected = $Form.find('input[type=checkbox]:checked').length;
	if ( cFriendsSelected == 0 )
	{
		ShowAlertDialog( strTitle, '您尚未選擇任何好友。' );
		return;
	}

	var strDescription = strSingluarDescription;
	if ( cFriendsSelected != 1 )
		strDescription = strPluralDescription.replace( /%s/, cFriendsSelected );

	ShowConfirmDialog( strTitle, strDescription).done( function() {
		ManageFriendsExecuteBulkAction( $Form, strActionName );
	});
}

function ManageFriendsBlock( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'ignore', '封鎖',
		'您確定要封鎖這位好友嗎？' + ' ' + '您將無法傳送訊息或邀請給此玩家，或接收來自此玩家的訊息或邀請。',
		'您確定要封鎖這 %s 位好友嗎？' + ' ' + '您將無法傳送訊息或邀請給這些玩家，或接收來自這些玩家的訊息或邀請。');
}

function ManageFriendsRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'remove', '移除好友',
		'您確定要移除這位好友嗎？' + ' ' + '此玩家再也不會出現在您的好友名單，且您將無法與其保持聯繫。',
		'您確定要移除這 %s 位好友嗎？' + ' ' + '這些玩家再也不會出現在您的好友名單，且您將無法與其保持聯繫。');
}

function ManageFollowingRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'removefollowing', '從您的關注清單移除？',
		'您確定要停止關注這個人？',
		'您確定要停止關注 %s 個人嗎？');
}

function ManageFriendsAddFriends( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'addfriend', '新增至好友名單',
		'您確定要傳送好友邀請給所選的玩家？ ',
		'您確定要傳送好友邀請給所選的玩家？ '	);
}



var AliasesLoaded = false;
function ShowAliasPopup(e)
{
	ShowMenu( e, 'NamePopup', 'left' );

	if( AliasesLoaded )
		return true;

	var aliasContainer = $( 'NamePopupAliases' );

	var throbber = document.createElement( 'img' );
	throbber.src = 'https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif';
	aliasContainer.appendChild( throbber );

	new Ajax.Request( g_rgProfileData['url'] + 'ajaxaliases/', {
		method: 'post',
		parameters: { },
		onSuccess: function( transport ) {

			var Aliases = transport.responseJSON;

			if( !aliasContainer )
				return;

			aliasContainer.update('');

			if( !Aliases || Aliases.length == 0 )
				Aliases.push( {newname: "此使用者並沒有已知別稱"} );
			else
				$( 'NamePopupClearAliases' ).show();

			for( var x=0; x<Aliases.length; x++ )
			{
				var c = Aliases[x];

				var curSpan = document.createElement( 'p' );
				var curATN = document.createTextNode( c['newname'] );
				curSpan.appendChild( curATN );
				aliasContainer.appendChild( curSpan );
			}

			AliasesLoaded = true;
		},
		onFailure: function( transport ) { alert( 'Please try again later' ); }
	} );
}

function ShowClearAliasDialog()
{
	ShowConfirmDialog( '清除別稱紀錄', '您確定要清除個人檔案別稱紀錄嗎？這會讓曾經與您一同遊玩的使用者更難找到您，也可能讓好友名單中的好友難以認出您。' )
		.done( function() {
			$J.ajax( {
				url: g_rgProfileData['url'] + 'ajaxclearaliashistory/',
				data: { sessionid: g_sessionID },
				type: 'POST',
				dataType: 'json'
			}).done( function( data ) {
				if ( data.success != 1 )
				{
					ShowAlertDialog( '', '處理您的請求時發生錯誤。請再試一次。' );
				}
				else
				{
					location.reload();
				}
			}).fail( function( data ) {
				ShowAlertDialog( '', '處理您的請求時發生錯誤。請再試一次。' );
			})
		} );
}

function IsValidNickname( str )
{
	return str.length == 0 || str.strip().length > 2;
}

function ShowNicknameModal( )
{
	// Show the dialogue
	ShowPromptDialog( "\u65b0\u589e\u66b1\u7a31", "\u70ba\u9019\u4f4d\u73a9\u5bb6\u65b0\u589e\u6c38\u4e45\u66b1\u7a31\u4ee5\u4fbf\u8ffd\u8e64\u4ed6\u5011\u7684\u8eab\u5206\u3002", "\u65b0\u589e\u66b1\u7a31", "\u53d6\u6d88" )
		.done( function( nickname, other ) {
			// User clicked 'OK', so we have a value; need to send it to the server
			$J.ajax( { url: g_rgProfileData['url'] + "ajaxsetnickname/",
				data: { nickname: nickname, sessionid: g_sessionID },
				type: 'POST',
				dataType: 'json'
			} ).done( function( data ) {
				// Got request result back, show it on the page
				if(data.nickname != undefined && data.nickname.length > 0)
				{
					$target = $J('.persona_name .nickname');
					// Add the nickname element if we don't already have one.
					if( $target.length == 0 )
						$target = $J('<span class="nickname"></span>').insertBefore( '.namehistory_link' );

					$target.text( "(" + data.nickname + ") " );
					$target.show();
				} else
					$J('.persona_name .nickname').hide();

			}).fail( function( data ) {
				ShowAlertDialog( '', data.results ? data.results : '處理您的請求時發生錯誤。請再試一次。' );
			});

		}
	);
}

function SetFollowing( bFollowing, fnOnSuccess )
{
	var url = bFollowing ? g_rgProfileData['url'] + "followuser/" : g_rgProfileData['url'] + "unfollowuser/";
	$J.ajax( { url: url,
		data: { sessionid: g_sessionID },
		type: 'POST',
		dataType: 'json'
	} ).done( function( data ) {
		fnOnSuccess( bFollowing );
	}).fail( function( data ) {
		ShowAlertDialog( '', data.results ? data.results : '處理您的請求時發生錯誤。請再試一次。' );
	});
}


function ShowFriendSelect( title, fnOnSelect )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>', '取消' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {type: 'friends'};

	$J.get( 'https://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		$ListElement.find( 'a' ).remove();
		$ListElement.find( '[data-miniprofile]').each( function() {
			var $El = $J(this);
			$El.click( function() {  Modal.Dismiss(); fnOnSelect( $El.data('miniprofile') ); } );
		} );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
	});
}

function StartTradeOffer( unAccountID, rgParams )
{
	var params = rgParams || {};
	params['partner'] = unAccountID;
	ShowTradeOffer( 'new', params );
}

function CancelTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'撤銷交易提案',
		'您確定您要取消本交易提案嗎？',
		'是',
		'否'
	).done( function() {
		ActOnTradeOffer( tradeOfferID, 'cancel', '交易提案已撤銷', '撤銷交易提案' );
	} );
}

function DeclineTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'拒絕交易',
		'您確定要拒絕本交易提案嗎？您也可以變更交易內容並重新議價。',
		'拒絕交易',
		null,
		'重新議價'
	).done( function( strButton ) {
		if ( strButton == 'OK' )
			ActOnTradeOffer( tradeOfferID, 'decline', '已拒絕交易', '拒絕交易' );
		else
			ShowTradeOffer( tradeOfferID, {counteroffer: 1} );
	} );
}

function ActOnTradeOffer( tradeOfferID, strAction, strCompletedBanner, strActionDisplayName )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();

	return $J.ajax( {
		url: 'https://steamcommunity.com/tradeoffer/' + tradeOfferID + '/' + strAction,
		data: { sessionid: g_sessionID },
		type: 'POST',
		crossDomain: true,
		xhrFields: { withCredentials: true }
	}).done( function( data ) {
		AddTradeOfferBanner( tradeOfferID, strCompletedBanner, false );

		RefreshNotificationArea();
	}).fail( function() {
		ShowAlertDialog( strActionDisplayName, '修改交易提案時發生錯誤，請稍後再試。' );
		$TradeOffer.find( '.tradeoffer_footer_actions').show();
	});
}

function AddTradeOfferBanner( tradeOfferID, strCompletedBanner, bAccepted )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();
	$TradeOffer.find( '.link_overlay' ).hide();
	$TradeOffer.find( '.tradeoffer_items_ctn').removeClass( 'active' ).addClass( 'inactive' );

	var $Banner = $J('<div/>', {'class': 'tradeoffer_items_banner' } );
	if ( bAccepted )
		$Banner.addClass( 'accepted' );

	$Banner.text( strCompletedBanner );
	$TradeOffer.find( '.tradeoffer_items_rule').replaceWith( $Banner );
}

