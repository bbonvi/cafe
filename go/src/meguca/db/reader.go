package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"meguca/auth"
	"meguca/common"

	"github.com/lib/pq"
)

type threadScanner struct {
	common.Thread
}

func (t *threadScanner) ScanArgs() []interface{} {
	return []interface{}{
		&t.Sticky, &t.Board,
		&t.PostCtr, &t.ImageCtr,
		&t.ReplyTime, &t.BumpTime,
		&t.Subject,
	}
}

func (t *threadScanner) Val() common.Thread {
	return t.Thread
}

type postScanner struct {
	common.Post
	auth     sql.NullString
	userID   sql.NullString
	userName sql.NullString
	settings sql.NullString
	links    linkRow
	commands commandRow
}

func (p *postScanner) ScanArgs() []interface{} {
	return []interface{}{&p.ID, &p.Time, &p.auth, &p.userID, &p.userName, &p.Body, &p.links, &p.commands, &p.settings}
}

type AccountSettings struct {
	Color string `json:"color,omitempty"`
}

// type data struct {
// 	key             string          `json:"Key"`
// 	AccountSettings AccountSettings `json:"AccountSettings"`
// }

type NullString sql.NullString
type String sql.NullString

func getColorFromJSON(s string) string {
	var byt = []byte(s)
	var dat map[string]interface{}

	if err := json.Unmarshal(byt, &dat); err != nil {
		// fmt.Println(err)
	}
	color := dat["color"]
	str := ""
	if color != nil {
		str = dat["color"].(string)
	}
	return str
}

// func checkContrast(s string)

func (p *postScanner) Val() common.Post {
	UserColor := getColorFromJSON(p.settings.String)
	// UserColor = checkContrast(UserColor)
	p.Auth = p.auth.String
	p.UserID = p.userID.String
	p.UserName = p.userName.String
	p.UserColor = UserColor
	p.Links = [][2]uint64(p.links)
	p.Commands = []common.Command(p.commands)
	// p.Settings = p.settings.String
	return p.Post
}

type fileScanner struct {
	APNG, Audio, Video                sql.NullBool
	FileType, ThumbType, Length, Size sql.NullInt64
	Name, SHA1, MD5, Title, Artist    sql.NullString
	Dims                              pq.Int64Array
}

func (i *fileScanner) ScanArgs() []interface{} {
	return []interface{}{
		&i.APNG, &i.Audio, &i.Video, &i.FileType, &i.ThumbType, &i.Dims,
		&i.Length, &i.Size, &i.MD5, &i.SHA1, &i.Title, &i.Artist,
	}
}

func (i *fileScanner) Val() *common.Image {
	if !i.SHA1.Valid {
		return nil
	}

	var dims [4]uint16
	for j := range dims {
		dims[j] = uint16(i.Dims[j])
	}

	return &common.Image{
		ImageCommon: common.ImageCommon{
			APNG:      i.APNG.Bool,
			Audio:     i.Audio.Bool,
			Video:     i.Video.Bool,
			FileType:  uint8(i.FileType.Int64),
			ThumbType: uint8(i.ThumbType.Int64),
			Length:    uint32(i.Length.Int64),
			Dims:      dims,
			Size:      int(i.Size.Int64),
			MD5:       i.MD5.String,
			SHA1:      i.SHA1.String,
			Title:     i.Title.String,
			Artist:    i.Artist.String,
		},
	}
}

func scanCatalog(r tableScanner) (b common.Board, err error) {
	defer r.Close()
	b = make(common.Board, 0, 32)
	for r.Next() {
		var t common.Thread
		t, err = scanCatalogThread(r)
		if err != nil {
			return
		}
		b = append(b, t)
	}
	err = r.Err()
	return
}

// Thread with one post and image (if any) attached.
func scanCatalogThread(r rowScanner) (t common.Thread, err error) {
	var (
		ts threadScanner
		ps postScanner
		fs fileScanner
	)
	args := make([]interface{}, 0)
	args = append(args, ts.ScanArgs()...)
	args = append(args, ps.ScanArgs()...)
	args = append(args, fs.ScanArgs()...)

	err = r.Scan(args...)
	if err != nil {
		return
	}

	t = ts.Val()
	p := ps.Val()
	t.Post = &p
	img := fs.Val()
	if img != nil {
		t.Files = append(t.Files, img)
	}
	return
}

// Just a thread with post attached.
func scanThread(r rowScanner) (t common.Thread, err error) {
	var (
		ts threadScanner
		ps postScanner
	)
	args := append(ts.ScanArgs(), ps.ScanArgs()...)
	err = r.Scan(args...)
	if err != nil {
		return
	}

	t = ts.Val()
	p := ps.Val()
	t.Post = &p
	return
}

func scanImage(r rowScanner) (img common.ImageCommon, err error) {
	var fs fileScanner
	err = r.Scan(fs.ScanArgs()...)
	if err != nil {
		return
	}
	img = fs.Val().ImageCommon
	return
}

func scanThreadIDs(r tableScanner) (ids []uint64, err error) {
	defer r.Close()
	ids = make([]uint64, 0, 64)
	for r.Next() {
		var id uint64
		err = r.Scan(&id)
		if err != nil {
			return
		}
		ids = append(ids, id)
	}
	err = r.Err()
	return
}

// PostStats contains post open status, body and creation time.
type PostStats struct {
	ID   uint64
	Time int64
	Body []byte
}

// GetAllBoardCatalog retrieves all OPs for the "/all/" meta-board.
func GetAllBoardCatalog() (common.Board, error) {
	r, err := prepared["get_all_catalog"].Query()
	if err != nil {
		return nil, err
	}
	return scanCatalog(r)
}

// GetBoardCatalog retrieves all OPs of a single board.
func GetBoardCatalog(board string) (common.Board, error) {
	r, err := prepared["get_catalog"].Query(board)
	if err != nil {
		return nil, err
	}
	return scanCatalog(r)
}

func findReactionsInList(re common.Reacts, id uint64) (r common.Reacts, err error) {
	for _, v := range re {
		if v.PostID == id {
			r = append(r, v)
		}
	}
	return r, nil

}

// GetThread retrieves public thread data from the database.
func GetThread(id uint64, lastN int) (t common.Thread, err error) {
	// Read all data in single transaction.
	tx, err := StartTransaction()
	if err != nil {
		return
	}
	defer tx.Rollback()
	err = SetReadOnly(tx)
	if err != nil {
		return
	}
	// Get thread info and OP post.
	t, err = scanThread(tx.Stmt(prepared["get_thread"]).QueryRow(id))
	if err != nil {
		return
	}

	// Partial thread routines.
	t.Abbrev = lastN != 0
	postCnt := int(t.PostCtr)
	var limit *int
	if lastN != 0 {
		postCnt = lastN
		limit = &lastN
	}

	// Get thread posts.
	r, err := tx.Stmt(prepared["get_thread_posts"]).Query(id, limit)
	if err != nil {
		return
	}
	defer r.Close()

	re, err := GetThreadReacts(id)
	if err != nil {
		fmt.Print(err)
	}
	threadReactions, err := findReactionsInList(re, id)
	if err != nil {
		fmt.Print(err)
	} else {
		t.Reacts = threadReactions
	}

	// Fill thread posts.
	var ps postScanner
	args := ps.ScanArgs()
	t.Posts = make([]*common.Post, 0, postCnt)
	postIds := make([]uint64, 1, postCnt+1) // + OP
	postIds[0] = id
	postsById := make(map[uint64]*common.Post, postCnt+1) // + OP
	postsById[t.ID] = t.Post
	for r.Next() {
		err = r.Scan(args...)
		if err != nil {
			return
		}
		p := ps.Val()
		t.Posts = append(t.Posts, &p)
		postIds = append(postIds, p.ID)
		postsById[p.ID] = &p

		postReactions, err := findReactionsInList(re, p.ID)
		if err != nil {
			postsById[p.ID].Reacts = make(common.Reacts, 0, 64)
			continue
		}
		postsById[p.ID].Reacts = postReactions
	}
	err = r.Err()
	if err != nil {
		return
	}

	// Get thread files.
	var r2 *sql.Rows
	if lastN == 0 {
		r2, err = tx.Stmt(prepared["get_thread_files"]).Query(id)
	} else {
		ids := pq.Array(postIds)
		r2, err = tx.Stmt(prepared["get_abbrev_thread_files"]).Query(ids)
	}
	if err != nil {
		return
	}
	defer r2.Close()

	// Fill posts files.
	var fs fileScanner
	var pID uint64
	args = append([]interface{}{&pID}, fs.ScanArgs()...)
	for r2.Next() {
		err = r2.Scan(args...)
		if err != nil {
			return
		}
		img := fs.Val()
		if p, ok := postsById[pID]; ok {
			p.Files = append(p.Files, img)
		}
	}
	err = r2.Err()
	return
}

// AssertNotReacted ensures that user with following ip or accountID
// haven't reacted to post with following smileName
func AssertNotReacted(
	ss *auth.Session,
	ip string,
	postID uint64,
	smileName string,
) (r bool) {
	var userID *string
	if ss != nil {
		userID = &ss.UserID
	}
	err := prepared["assert_user_not_reacted"].QueryRow(
		ip,
		userID,
		postID,
		smileName,
	).Scan(&r)
	if err != nil {
		return false
	}
	return
}

// GetPostReactCount reads a single post reaction from the database.
func GetPostReactCount(id uint64, smile_name string) (count uint64, err error) {
	err = prepared["get_post_react_count"].QueryRow(id, smile_name).Scan(&count)
	return
}

// GetThreadUserReacts reads a list of thread reactions
func GetThreadUserReacts(ss *auth.Session, ip string, threadID uint64) (reacts common.Reacts, err error) {
	var userID *string
	if ss != nil {
		userID = &ss.UserID
	}
	rows, err := prepared["get_user_reacts"].Query(userID, ip, threadID)
	if err != nil {
		return nil, err
	}

	reacts = make(common.Reacts, 0, 64)
	var p common.React

	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&p.Count, &p.SmileName, &p.PostID)
		if err != nil {
			err = errors.New("something went wrong")
			return
		}
		reacts = append(reacts, p)
	}
	err = rows.Err()
	return
}

// GetThreadReacts reads a list of thread reactions
func GetThreadReacts(id uint64) (reacts common.Reacts, err error) {
	rows, err := prepared["get_thread_reacts"].Query(id)
	if err != nil {
		return nil, err
	}

	reacts = make(common.Reacts, 0, 64)
	var p common.React

	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&p.Count, &p.SmileName, &p.PostID)
		if err != nil {
			err = errors.New("something went wrong")
			return
		}
		reacts = append(reacts, p)
	}
	err = rows.Err()
	return
}

// GetPostReacts reads a list of post reactions
func GetPostReacts(id uint64) (reacts common.Reacts, err error) {
	rows, err := prepared["get_post_reacts"].Query(id)
	if err != nil {
		return nil, err
	}

	reacts = make(common.Reacts, 0, 64)
	var p common.React

	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&p.Count, &p.SmileName, &p.PostID)
		if err != nil {
			return
		}
		reacts = append(reacts, p)
	}
	err = rows.Err()
	return
}

// GetPost reads a single post from the database.
func GetPost(id uint64) (p common.StandalonePost, err error) {
	// Read all data in single transaction.
	tx, err := StartTransaction()
	if err != nil {
		return
	}
	defer tx.Rollback()
	err = SetReadOnly(tx)
	if err != nil {
		return
	}
	// Get post.
	var ps postScanner
	args := append(ps.ScanArgs(), &p.OP, &p.Board)

	err = tx.Stmt(prepared["get_post"]).QueryRow(id).Scan(args...)
	if err != nil {
		return
	}
	p.Post = ps.Val()

	// Get post files.
	r, err := tx.Stmt(prepared["get_post_files"]).Query(id)
	if err != nil {
		return
	}
	defer r.Close()
	// Fill post files.
	var fs fileScanner
	args = fs.ScanArgs()
	for r.Next() {
		err = r.Scan(args...)
		if err != nil {
			return
		}
		img := fs.Val()
		p.Files = append(p.Files, img)
	}

	err = r.Err()

	return
}

// Retrieves all threads IDs in bump order with stickies first.
func GetAllThreadsIDs() ([]uint64, error) {
	r, err := prepared["get_all_thread_ids"].Query()
	if err != nil {
		return nil, err
	}
	return scanThreadIDs(r)
}

// Retrieves threads IDs on the board.
func GetThreadIDs(board string) ([]uint64, error) {
	r, err := prepared["get_board_thread_ids"].Query(board)
	if err != nil {
		return nil, err
	}
	return scanThreadIDs(r)
}

// GetRecentPosts retrieves recent posts created in the thread.
func GetRecentPosts(op uint64) (posts []PostStats, err error) {
	r, err := prepared["get_recent_posts"].Query(op)
	if err != nil {
		return
	}
	defer r.Close()

	posts = make([]PostStats, 0, 64)
	var p PostStats
	for r.Next() {
		err = r.Scan(&p.ID, &p.Time)
		if err != nil {
			return
		}
		posts = append(posts, p)
	}
	err = r.Err()
	return
}

// Retrieve latest news.
func GetNews() (news []common.NewsEntry, err error) {
	r, err := prepared["get_news"].Query()
	if err != nil {
		return
	}
	defer r.Close()

	news = make([]common.NewsEntry, 0, 5)
	var entry common.NewsEntry
	for r.Next() {
		err = r.Scan(&entry.Subject, &entry.Body, &entry.ImageName, &entry.Time)
		if err != nil {
			return
		}
		news = append(news, entry)
	}
	err = r.Err()
	return
}
