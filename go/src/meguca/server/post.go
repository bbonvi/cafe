// Various POST request handlers

package server

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"smiles"
	"strconv"
	"strings"

	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/feeds"
	"meguca/websockets"
)

// Serve a single post as JSON
func servePost(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(getParam(r, "post"), 10, 64)
	if err != nil {
		text400(w, err)
		return
	}

	t, _ := db.GetPostReacts(id)

	switch post, err := db.GetPost(id); err {
	case nil:
		ss, _ := getSession(r, post.Board)
		if !assertNotModOnly(w, r, post.Board, ss) {
			return
		}
		post.Reacts = t

		serveJSON(w, r, post)

	case sql.ErrNoRows:
		serve404(w, r)
	default:
		respondToJSONError(w, r, err)
	}
}

func getHashedHeaders(r *http.Request) string {
	str := strings.Join(r.Header["User-Agent"][:], "")
	str += strings.Join(r.Header["Accept"], "")
	str += strings.Join(r.Header["Accept-Language"], "")
	str += strings.Join(r.Header["Accept-Encoding"], "")
	str += strings.Join(r.Header["Sec-Fetch-Site"], "")
	str += strings.Join(r.Header["Connection"], "")

	hasher := sha256.New()
	_, err := hasher.Write([]byte(str))
	if err != nil {
		return ""
	}

	return base64.URLEncoding.EncodeToString(hasher.Sum(nil))
}

// Client should get token and solve challenge in order to post.
func createPostToken(w http.ResponseWriter, r *http.Request) {
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}

	token, err := db.NewPostToken(ip)
	switch err {
	case nil:
	case db.ErrTokenForbidden:
		text403(w, err)
		return
	default:
		text500(w, r, err)
		return
	}

	res := map[string]string{"id": token}
	serveJSON(w, r, res)
}

func getTreadUserReaction(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(getParam(r, "thread"), 10, 64)
	if err != nil {
		text400(w, err)
		return
	}
	ss, _ := getSession(r, "")

	re, err := db.GetThreadUserReacts(ss, id)
	if err != nil {
		text404(w, err)
		return
	}
	serveJSON(w, r, re)
}

func getBoardSmiles(w http.ResponseWriter, r *http.Request) {
	b := getParam(r, "board")
	if !assertBoardAPI(w, b) {
		return
	}

	sm, err := db.GetBoardSmiles(b)
	if err != nil {
		text404(w, err)
		return
	}
	serveJSON(w, r, sm)
}

// Create thread.
func createThread(w http.ResponseWriter, r *http.Request) {
	postReq, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Map form data to websocket thread creation request.
	subject := r.Form.Get("subject")
	req := websockets.ThreadCreationRequest{
		PostCreationRequest: postReq,
		Subject:             subject,
	}

	post, err := websockets.CreateThread(req)
	if err != nil {
		// TODO(Kagami): Not all errors are 400.
		// TODO(Kagami): Write JSON errors instead.
		text400(w, err)
		return
	}

	res := map[string]uint64{"id": post.ID}
	serveJSON(w, r, res)
}

// var (
// 	reactionFeedQueue common.Reacts
// )

func init() {
	// go syncReacts()
}

// TODO: handle reaction queue
// For perfomance reason we could collect reactions
// for about half of the second and then send them all to the clients
// func syncReacts() {
// 	time.Sleep(time.Second)

// 	ms := time.Tick(time.Millisecond * 500)

// 	for {
// 		select {
// 		case <-ms:
// 			threadMap := createMap(reactionFeedQueue)
// 			reactionFeedQueue = reactionFeedQueue[:0]
// 			for threadID := range threadMap {

// 				sendToFeed(reactionFeedQueue, threadID)
// 			}

// 		}
// 	}
// }

type threadMap map[uint64]postMap
type postMap map[uint64]smileMap
type smileMap map[string]uint64

func isNil(v interface{}) bool {
	return v == nil ||
		(reflect.ValueOf(v).Kind() ==
			reflect.Ptr && reflect.ValueOf(v).IsNil())
}

// removes duplicate reactions and
func createMap(reactQueue common.Reacts) threadMap {
	t := make(threadMap)
	p := make(postMap)

	// smileMap to PostIDs
	for _, r := range reactQueue {
		PostID := r.PostID
		SmileID := r.SmileName

		if p[PostID] == nil {
			p[PostID] = make(smileMap)
		}

		count := p[PostID][SmileID]
		if isNil(count) {
			count = 1
		} else {
			count++
		}

		p[PostID][SmileID] = count
	}

	// Map postMap to ThreadID
	for postID, m := range p {
		// fmt.Println(o, r)
		threadID, err := db.GetPostOP(postID)
		if err == nil {
			if t[threadID] == nil {
				t[threadID] = make(postMap)
			}
			t[threadID][postID] = m
		}
	}

	return t
}

type reactionJSON struct {
	SmileName string `json:"smileName,omitempty"`
	PostID    uint64 `json:"postId,omitempty"`
}

func reactToPost(w http.ResponseWriter, r *http.Request) {
	var re reactionJSON
	if err := readJSON(r, &re); err != nil {
		return
	}

	threadID, err := db.GetPostOP(re.PostID)
	if err != nil {
		err = errors.New("Couldn't get post's thread")
		text404(w, err)
		return
	}

	if !smiles.Smiles[re.SmileName] {
		err := errors.New("Smile not found")
		text404(w, err)
		return
	}

	// Get Client Session and IP
	ss, _ := getSession(r, "")
	if ss == nil {
		e := errors.New("You are not authorized")
		text400(w, e)
		return
	}

	alreadyReacted := !db.AssertNotReacted(ss, re.PostID, re.SmileName)

	exist := true
	count := db.GetPostReactCount(re.PostID, re.SmileName)
	// Set count to 0 if reaction not yet exist
	if count == 0 {
		exist = false
	}

	// Decrement counter if user already reacted
	if alreadyReacted {
		count--
	} else {
		count++
	}

	// Create reaction or set count to value. Get post_react id in return.
	reactionID, err := updatePostReaction(re, count, exist)

	err = handleUserReaction(ss, reactionID, alreadyReacted)
	if err != nil {
		text500(w, r, err)
		return
	}

	res := common.React{
		SmileName: re.SmileName,
		Count:     count,
		PostID:    re.PostID,
		Self:      !alreadyReacted,
	}
	// make success response to the client
	serveJSON(w, r, res)

	react := common.React{
		SmileName: re.SmileName,
		Count:     count,
		PostID:    re.PostID,
	}
	var reacts common.Reacts
	reacts = append(reacts, react)
	sendReactionsToFeed(reacts, threadID)
}

func handleUserReaction(ss *auth.Session, reactionID uint64, reacted bool) (err error) {
	if !reacted {
		// create user_reaction refering ip and account_id(if it exists)
		err = db.InsertUserReaction(ss, reactionID)
		return
	}
	err = db.DeleteUserReaction(ss, reactionID)
	return
}

func updatePostReaction(re reactionJSON, count uint64, exist bool) (postReactionID uint64, err error) {
	if exist {
		if count < 1 {
			err = db.DeletePostReaction(re.PostID, re.SmileName)
			return 0, err
		}
		postReactionID, err = db.UpdateReactionCount(re.PostID, re.SmileName, count)
		return
	}
	postReactionID, err = db.InsertPostReaction(re.PostID, re.SmileName)
	return
}

func createSmile(w http.ResponseWriter, r *http.Request) {
	f, m, err := parseUploadForm(w, r)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}

	// Board and user validation.
	board := f.Get("board")
	if !assertBoardAPI(w, board) {
		return
	}

	ss, _ := getSession(r, board)
	if ss == nil || ss.Positions.CurBoard < auth.BoardOwner {
		serveErrorJSON(w, r, aerrBoardOwnersOnly)
		return
	}

	fhs := m.File["files[]"]
	if len(fhs) > 1 {
		serveErrorJSON(w, r, aerrTooManyFiles)
		return
	}
	if len(fhs) < 1 {
		serveErrorJSON(w, r, atleastOneFile)
		return
	}

	var smile *common.SmileCommon
	smile.Name = f.Get("smileName")
	smile.Board = board

	res, err := uploadSmile(fhs[0], smile)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}
	fmt.Println(res)

	// modOnly := config.IsModOnlyBoard(board)
	// req = websockets.PostCreationRequest{
	// 	FilesRequest: websockets.FilesRequest{tokens},
	// 	Board:        board,
	// 	Ip:           ip,
	// 	Body:         body,
	// 	UniqueID:     uniqueID,
	// 	Token:        f.Get("token"),
	// 	Sign:         f.Get("sign"),
	// 	ShowBadge:    f.Get("showBadge") == "on" || modOnly,
	// 	ShowName:     modOnly,
	// 	Session:      ss,
	// }
	return
}

// Create post.
func createPost(w http.ResponseWriter, r *http.Request) {
	req, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Check board and thread.
	thread := r.Form.Get("thread")
	op, err := strconv.ParseUint(thread, 10, 64)
	if err != nil {
		text400(w, err)
		return
	}
	ok, err = db.ValidateOP(op, req.Board)
	if err != nil {
		text500(w, r, err)
		return
	}
	if !ok {
		text400(w, fmt.Errorf("invalid thread: /%s/%d", req.Board, op))
		return
	}

	post, msg, err := websockets.CreatePost(req, op)
	if err != nil {
		text400(w, err)
		return
	}
	feeds.InsertPostInto(post.StandalonePost, msg)

	res := map[string]uint64{"id": post.ID}
	serveJSON(w, r, res)
}

// ok = false if failed and caller should return.
func parsePostCreationForm(w http.ResponseWriter, r *http.Request) (
	req websockets.PostCreationRequest, ok bool,
) {
	uniqueID := getHashedHeaders(r)[:10]

	f, m, err := parseUploadForm(w, r)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}

	// Board and user validation.
	board := f.Get("board")
	if !assertBoardAPI(w, board) {
		return
	}
	if board == "all" {
		text400(w, errInvalidBoard)
		return
	}
	ss, _ := getSession(r, board)
	if !assertNotModOnlyAPI(w, board, ss) {
		return
	}
	if !assertNotRegisteredOnlyAPI(w, board, ss) {
		return
	}

	if !assertNotBlacklisted(w, board, ss) {
		return
	}

	if !assertNotWhitelistOnlyAPI(w, board, ss) {
		return
	}

	if !assertNotReadOnlyAPI(w, board, ss) {
		return
	}

	ip, allowed := assertNotBannedAPI(w, r, board)
	if !allowed {
		return
	}

	// TODO: Move to config
	// if !assertHasWSConnection(w, ip, board) {
	// 	return
	// }

	fhs := m.File["files[]"]
	if len(fhs) > config.Get().MaxFiles {
		serveErrorJSON(w, r, aerrTooManyFiles)
		return
	}
	tokens := make([]string, len(fhs))
	for i, fh := range fhs {
		res, err := uploadFile(fh)
		if err != nil {
			serveErrorJSON(w, r, err)
			return
		}
		tokens[i] = res.token
	}

	// NOTE(Kagami): Browsers use CRLF newlines in form-data requests,
	// see: <https://stackoverflow.com/a/6964163>.
	// This in particular breaks links formatting, also we need to be
	// consistent with WebSocket requests and store normalized data in DB.
	body := f.Get("body")
	body = strings.Replace(body, "\r\n", "\n", -1)

	modOnly := config.IsModOnlyBoard(board)
	req = websockets.PostCreationRequest{
		FilesRequest: websockets.FilesRequest{tokens},
		Board:        board,
		Ip:           ip,
		Body:         body,
		UniqueID:     uniqueID,
		Token:        f.Get("token"),
		Sign:         f.Get("sign"),
		ShowBadge:    f.Get("showBadge") == "on" || modOnly,
		ShowName:     modOnly,
		Session:      ss,
	}
	ok = true
	return
}

type reactsMessage struct {
	Reacts common.Reacts `json:"reacts"`
}

func sendReactionsToFeed(r common.Reacts, threadID uint64) error {
	var rm reactsMessage
	rm.Reacts = r
	msgType := `30`
	t := make([]byte, 0, 1<<10)
	t = append(t, msgType...)

	msg, _ := json.Marshal(rm)

	t = append(t, msg...)
	feeds.SendTo(threadID, t)
	return nil
}
